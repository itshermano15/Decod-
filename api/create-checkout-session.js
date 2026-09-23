const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

module.exports = async function createCheckoutSession(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'Método no permitido.');
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const siteUrl = process.env.SITE_URL || 'https://decodo.vercel.app';

  if (!stripeKey || !supabaseUrl || !supabasePublishableKey) {
    return fail(res, 500, 'Falta configurar el pago en el servidor.');
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const rawItems = Array.isArray(body?.items) ? body.items : [];

  if (!rawItems.length || rawItems.length > 25) {
    return fail(res, 400, 'El carrito no es válido.');
  }

  const quantities = new Map();
  for (const item of rawItems) {
    const id = String(item?.id || '');
    const quantity = Number(item?.qty);

    if (!UUID.test(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return fail(res, 400, 'El carrito no es válido.');
    }

    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }

  const ids = [...quantities.keys()];
  const productFilter = encodeURIComponent(
    '(' + ids.join(',') + ')'
  );

  const productsResponse = await fetch(
    supabaseUrl.replace(/\/$/, '') +
      '/rest/v1/products?select=id,name,description,price_cents,stock,active&id=in.' +
      productFilter,
    {
      headers: {
        apikey: supabasePublishableKey,
        Authorization: 'Bearer ' + supabasePublishableKey
      }
    }
  );

  if (!productsResponse.ok) {
    return fail(res, 502, 'No se pudo comprobar el catálogo.');
  }

  const products = await productsResponse.json();
  const productsById = new Map(products.map((product) => [product.id, product]));
  const validatedItems = [];

  for (const [id, quantity] of quantities) {
    const product = productsById.get(id);
    const price = Number(product?.price_cents);
    const stock = Number(product?.stock);

    if (!product || product.active !== true || !Number.isInteger(price) || price < 1 || !Number.isInteger(stock) || stock < quantity) {
      return fail(res, 409, 'Un producto ya no está disponible con esa cantidad. Actualiza el carrito e inténtalo de nuevo.');
    }

    validatedItems.push({ product, quantity, price });
  }

  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', siteUrl.replace(/\/$/, '') + '/?checkout=success&session_id={CHECKOUT_SESSION_ID}');
  form.set('cancel_url', siteUrl.replace(/\/$/, '') + '/?checkout=cancelled');
  form.set('billing_address_collection', 'required');

  validatedItems.forEach(({ product, quantity, price }, index) => {
    const prefix = 'line_items[' + index + ']';
    form.set(prefix + '[quantity]', String(quantity));
    form.set(prefix + '[price_data][currency]', 'eur');
    form.set(prefix + '[price_data][unit_amount]', String(price));
    form.set(prefix + '[price_data][product_data][name]', String(product.name).slice(0, 250));

    if (product.description) {
      form.set(prefix + '[price_data][product_data][description]', String(product.description).slice(0, 500));
    }
  });

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + stripeKey,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });

  const stripeData = await stripeResponse.json();

  if (!stripeResponse.ok || !stripeData.url) {
    console.error('Stripe Checkout error:', stripeData);
    return fail(res, 502, 'No se pudo iniciar el pago.');
  }

  return res.status(200).json({ url: stripeData.url });
};
