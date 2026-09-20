import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
} from './config.js';

const { createClient } = await import(
  'https://esm.sh/@supabase/supabase-js@2'
);

const db = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const login = document.querySelector('#login');
const dashboard = document.querySelector('#dashboard');
const loginForm = document.querySelector('#loginForm');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const loginError = document.querySelector('#loginError');
const logoutBtn = document.querySelector('#logout');

const productForm = document.querySelector('#productForm');
const formTitle = document.querySelector('#formTitle');
const nameInput = document.querySelector('#name');
const priceInput = document.querySelector('#price');
const categoryInput = document.querySelector('#category');
const stockInput = document.querySelector('#stock');
const descriptionInput = document.querySelector('#description');
const imageFileInput = document.querySelector('#imageFile');
const imageUrlInput = document.querySelector('#imageUrl');
const activeInput = document.querySelector('#active');

const saveBtn = document.querySelector('#saveBtn');
const cancelEditBtn = document.querySelector('#cancelEdit');
const formMessage = document.querySelector('#formMessage');

const sProducts = document.querySelector('#sProducts');
const sStock = document.querySelector('#sStock');
const sValue = document.querySelector('#sValue');
const list = document.querySelector('#list');

let products = [];
let editingId = null;

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

async function isAdmin() {
  const {
    data: { user }
  } = await db.auth.getUser();

  if (!user) return false;

  const { data } = await db
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return !!data;
}

async function loadProducts() {
  const { data, error } = await db
    .from('products')
    .select('*')
    .order('created_at', {
      ascending: false
    });

  if (error) {
    formMessage.textContent = error.message;
    return;
  }

  products = data || [];
  render();
}

function render() {
  sProducts.textContent = products.length;

  sStock.textContent = products.reduce(
    (total, p) => total + Number(p.stock || 0),
    0
  );

  sValue.textContent = euro(
    products.reduce(
      (total, p) =>
        total +
        Number(p.price_cents || 0) *
        Number(p.stock || 0),
      0
    ) / 100
  );

  if (!products.length) {
    list.innerHTML = '<p>No hay productos.</p>';
    return;
  }

  list.innerHTML = products.map((p) => `
    <div class="adminitem">
      <div class="product">
        <img
          src="${p.image_url || 'https://placehold.co/70'}"
          alt=""
        >
        <div>
          <b>${esc(p.name)}</b>
          <small>
            ${esc(p.category)} ·
            ${euro(Number(p.price_cents || 0) / 100)} ·
            stock ${p.stock} ·
            ${p.active ? 'Visible' : 'Oculto'}
          </small>
        </div>
      </div>

      <div>
        <button
          class="secondary"
          onclick="editProduct('${p.id}')"
        >
          Editar
        </button>

        <button
          class="danger"
          onclick="deleteProduct('${p.id}')"
        >
          Eliminar
        </button>
      </div>
    </div>
  `).join('');
}

async function showDashboard() {
  const admin = await isAdmin();

  if (!admin) {
    login.hidden = false;
    dashboard.hidden = true;
    return;
  }

  login.hidden = true;
  dashboard.hidden = false;

  await loadProducts();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  loginError.textContent = '';

  const { error } = await db.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value
  });

  if (error) {
    loginError.textContent =
      'Email o contraseña incorrectos.';
    return;
  }

  await showDashboard();
});

logoutBtn.addEventListener('click', async () => {
  await db.auth.signOut();
  location.reload();
});

window.editProduct = (id) => {
  const p = products.find((x) => x.id === id);

  if (!p) return;

  editingId = id;

  formTitle.textContent = 'Editar producto';
  saveBtn.textContent = 'Guardar cambios';
  cancelEditBtn.hidden = false;

  nameInput.value = p.name || '';
  priceInput.value = (
    Number(p.price_cents || 0) / 100
  ).toFixed(2);

  categoryInput.value = p.category || '';
  stockInput.value = p.stock || 0;
  descriptionInput.value = p.description || '';
  imageUrlInput.value = p.image_url || '';
  activeInput.checked = !!p.active;

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
};

window.deleteProduct = async (id) => {
  if (!confirm('¿Eliminar producto?')) return;

  const { error } = await db
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadProducts();
};

cancelEditBtn.addEventListener('click', () => {
  editingId = null;

  productForm.reset();
  activeInput.checked = true;

  formTitle.textContent = 'Nuevo producto';
  saveBtn.textContent = 'Publicar producto';
  cancelEditBtn.hidden = true;
  formMessage.textContent = '';
});

async function uploadImage(file) {
  const ext =
    file.name
      .split('.')
      .pop()
      .replace(/[^a-z0-9]/gi, '') || 'jpg';

  const path =
    crypto.randomUUID() + '.' + ext;

  const { error } = await db.storage
    .from('product-images')
    .upload(path, file, {
      contentType: file.type
    });

  if (error) throw error;

  return (
    SUPABASE_URL +
    '/storage/v1/object/public/product-images/' +
    path
  );
}

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  saveBtn.disabled = true;
  formMessage.textContent = '';

  try {
    let image = imageUrlInput.value.trim();

    if (imageFileInput.files.length > 0) {
      image = await uploadImage(
        imageFileInput.files[0]
      );
    }

    const product = {
      name: nameInput.value.trim(),

      slug:
        nameInput.value
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-') +
        '-' +
        Date.now(),

      description:
        descriptionInput.value.trim(),

      price_cents:
        Math.round(
          Number(priceInput.value) * 100
        ),

      stock:
        Number(stockInput.value),

      category:
        categoryInput.value.trim(),

      image_url:
        image || null,

      active:
        activeInput.checked
    };

    let result;

    if (editingId) {
      result = await db
        .from('products')
        .update(product)
        .eq('id', editingId);
    } else {
      result = await db
        .from('products')
        .insert(product);
    }

    if (result.error) {
      throw result.error;
    }

    formMessage.textContent =
      'Producto guardado correctamente.';

    cancelEditBtn.click();

    await loadProducts();

  } catch (error) {
    console.error(error);

    formMessage.textContent =
      'Error: ' + error.message;

  } finally {
    saveBtn.disabled = false;
  }
});

const {
  data: { session }
} = await db.auth.getSession();

if (session) {
  await showDashboard();
}
