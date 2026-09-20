import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const { createClient } = await import(
  'https://esm.sh/@supabase/supabase-js@2'
);

const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const productsEl = document.querySelector('#products');
const search = document.querySelector('#search');
const cartBtn = document.querySelector('#cartBtn');
const cartEl = document.querySelector('#cart');
const closeBtn = document.querySelector('#close');
const shade = document.querySelector('#shade');
const checkout = document.querySelector('#checkout');
const notice = document.querySelector('#notice');
const cartCount = document.querySelector('#cartCount');
const items = document.querySelector('#items');
const total = document.querySelector('#total');

let products = [];
let cart = JSON.parse(localStorage.getItem('decodo_cart') || '[]');

const euro = (n) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(n);

const esc = (s) =>
  String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

function saveCart() {
  localStorage.setItem(
    'decodo_cart',
    JSON.stringify(cart)
  );
}

async function load() {
  const { data, error } = await db
    .from('products')
    .select('*')
    .eq('active', true)
    .gt('stock', 0)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error cargando productos:', error);
    productsEl.textContent =
      'No se pudieron cargar los productos.';
    return;
  }

  products = data || [];

  // Eliminar del carrito productos que ya no existen
  // o que se han quedado sin stock.
  cart = cart.filter((item) => {
    const product = products.find(
      (p) => p.id === item.id
    );

    if (!product) return false;

    item.qty = Math.min(
      Number(item.qty),
      Number(product.stock)
    );

    return item.qty > 0;
  });

  saveCart();

  render();
  renderCart();
}

function render() {
  const q = search.value.toLowerCase();

  const filtered = products.filter((p) =>
    (p.name + ' ' + (p.category || ''))
      .toLowerCase()
      .includes(q)
  );

  productsEl.innerHTML =
    filtered.map((p) => `
      <article class="card">
        <img
          src="${p.image_url || 'https://placehold.co/700x700?text=Decodo'}"
          alt="${esc(p.name)}"
        >

        <div>
          <small>${esc(p.category)}</small>

          <h3>${esc(p.name)}</h3>

          <p>${esc(p.description)}</p>

          <b>${euro(p.price_cents / 100)}</b>

          <br>

          <button
            class="cta"
            data-add="${p.id}"
          >
            Añadir al carrito
          </button>
        </div>
      </article>
    `).join('') || '<p>No hay productos.</p>';

  document.querySelectorAll('[data-add]').forEach(
    (button) => {
      button.onclick = () =>
        add(button.dataset.add);
    }
  );
}

function add(id) {
  const product = products.find(
    (p) => p.id === id
  );

  if (!product) return;

  const existing = cart.find(
    (x) => x.id === id
  );

  if (existing) {
    if (existing.qty >= product.stock) {
      notice.textContent =
        'No hay más unidades disponibles.';
      openCart();
      return;
    }

    existing.qty += 1;
  } else {
    cart.push({
      id,
      qty: 1
    });
  }

  saveCart();
  renderCart();
  openCart();
}

function increase(id) {
  const product = products.find(
    (p) => p.id === id
  );

  const item = cart.find(
    (x) => x.id === id
  );

  if (!product || !item) return;

  if (item.qty >= product.stock) {
    notice.textContent =
      'Has alcanzado el stock disponible.';
    return;
  }

  item.qty += 1;

  saveCart();
  renderCart();
}

function decrease(id) {
  const item = cart.find(
    (x) => x.id === id
  );

  if (!item) return;

  item.qty -= 1;

  if (item.qty <= 0) {
    cart = cart.filter(
      (x) => x.id !== id
    );
  }

  saveCart();
  renderCart();
}

function removeItem(id) {
  cart = cart.filter(
    (x) => x.id !== id
  );

  saveCart();
  renderCart();
}

function renderCart() {
  const count = cart.reduce(
    (sum, item) =>
      sum + Number(item.qty),
    0
  );

  cartCount.textContent = count;

  if (!cart.length) {
    items.innerHTML =
      '<p>Tu carrito está vacío.</p>';

    total.textContent = euro(0);

    return;
  }

  items.innerHTML = cart.map((item) => {
    const product = products.find(
      (p) => p.id === item.id
    );

    if (!product) return '';

    const subtotal =
      Number(product.price_cents) *
      Number(item.qty);

    return `
      <div class="cart-item">

        <div class="cart-product">

          <img
            src="${
              product.image_url ||
              'https://placehold.co/80x80?text=Decodo'
            }"
            alt="${esc(product.name)}"
          >

          <div>
            <strong>
              ${esc(product.name)}
            </strong>

            <small>
              ${euro(product.price_cents / 100)}
              / unidad
            </small>
          </div>

        </div>

        <div class="cart-controls">

          <button
            type="button"
            data-minus="${product.id}"
          >
            −
          </button>

          <span>
            ${item.qty}
          </span>

          <button
            type="button"
            data-plus="${product.id}"
          >
            +
          </button>

        </div>

        <strong>
          ${euro(subtotal / 100)}
        </strong>

        <button
          type="button"
          class="remove-item"
          data-remove="${product.id}"
          aria-label="Eliminar producto"
        >
          🗑️
        </button>

      </div>
    `;
  }).join('');

  const cartTotal = cart.reduce(
    (sum, item) => {
      const product = products.find(
        (p) => p.id === item.id
      );

      if (!product) return sum;

      return (
        sum +
        Number(product.price_cents) *
        Number(item.qty)
      );
    },
    0
  );

  total.textContent =
    euro(cartTotal / 100);

  document
    .querySelectorAll('[data-plus]')
    .forEach((button) => {
      button.onclick = () =>
        increase(button.dataset.plus);
    });

  document
    .querySelectorAll('[data-minus]')
    .forEach((button) => {
      button.onclick = () =>
        decrease(button.dataset.minus);
    });

  document
    .querySelectorAll('[data-remove]')
    .forEach((button) => {
      button.onclick = () =>
        removeItem(button.dataset.remove);
    });
}

function openCart() {
  cartEl.classList.add('open');
  shade.classList.add('open');
}

function closeCart() {
  cartEl.classList.remove('open');
  shade.classList.remove('open');
}

cartBtn.onclick = openCart;
closeBtn.onclick = closeCart;
shade.onclick = closeCart;

search.oninput = render;

checkout.onclick = () => {
  if (!cart.length) {
    notice.textContent =
      'Tu carrito está vacío.';
    return;
  }

  notice.textContent =
    'El pago con Stripe se conectará en el siguiente paso.';
};

load();
