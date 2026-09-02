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

async function load() {
  const { data, error } = await db
    .from('products')
    .select('*')
    .eq('active', true)
    .gt('stock', 0)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error cargando productos:', error);
    productsEl.textContent = 'No se pudieron cargar los productos.';
    return;
  }

  products = data || [];
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
        <img src="${p.image_url || 'https://placehold.co/700x700?text=Decodo'}">
        <div>
          <small>${esc(p.category)}</small>
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description)}</p>
          <b>${euro(p.price_cents / 100)}</b>
          <br>
          <button class="cta" data-id="${p.id}">Añadir</button>
        </div>
      </article>
    `).join('') || '<p>No hay productos.</p>';

  document.querySelectorAll('[data-id]').forEach((button) => {
    button.onclick = () => add(button.dataset.id);
  });
}

function add(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;

  const existing = cart.find((x) => x.id === id);

  if (existing) {
    existing.qty = Math.min(existing.qty + 1, product.stock);
  } else {
    cart.push({ id, qty: 1 });
  }

  localStorage.setItem('decodo_cart', JSON.stringify(cart));
  renderCart();
  openCart();
}

function renderCart() {
  cartCount.textContent = cart.reduce(
    (sum, item) => sum + item.qty,
    0
  );

  items.innerHTML =
    cart.map((item) => {
      const product = products.find((p) => p.id === item.id);

      if (!product) return '';

      return `
        <div class="row">
          <span>${esc(product.name)} × ${item.qty}</span>
          <b>${euro(
            (product.price_cents * item.qty) / 100
          )}</b>
        </div>
      `;
    }).join('') || '<p>Carrito vacío.</p>';

  const cartTotal = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.id);
    return sum + (product?.price_cents || 0) * item.qty;
  }, 0);

  total.textContent = euro(cartTotal / 100);
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
  notice.textContent = 'Stripe se añadirá en la siguiente fase.';
};

load();
