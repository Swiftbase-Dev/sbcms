// Helper to generate the client-side cart drawer HTML and SBCart script

export function getCartDrawerAndScriptHtml(): string {
  return `
<!-- Floating Cart Button -->
<div id="sb-cart-floating-btn" onclick="window.SBCart && window.SBCart.openCart()" style="position:fixed;bottom:24px;right:24px;z-index:9990;cursor:pointer;display:flex;align-items:center;gap:10px;background:#0f172a;color:#ffffff;padding:12px 18px;border-radius:9999px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);font-family:system-ui,-apple-system,sans-serif;font-weight:700;font-size:14px;transition:transform 0.2s,box-shadow 0.2s;">
  <svg style="width:20px;height:20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
  </svg>
  <span>Cart</span>
  <span id="sb-cart-badge" style="background:#6366f1;color:#ffffff;font-size:11px;font-weight:800;border-radius:9999px;padding:2px 7px;display:none;">0</span>
</div>

<!-- Slide-out Cart Backdrop & Drawer -->
<div id="sb-cart-drawer-backdrop" onclick="window.SBCart && window.SBCart.closeCart()" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);z-index:9998;opacity:0;pointer-events:none;transition:opacity 0.3s ease;"></div>

<div id="sb-cart-drawer" style="position:fixed;top:0;right:-420px;width:100%;max-width:400px;height:100%;background:#ffffff;color:#0f172a;box-shadow:-10px 0 30px rgba(0,0,0,0.25);z-index:9999;transition:right 0.35s cubic-bezier(0.16,1,0.3,1);display:flex;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;">
  <!-- Drawer Header -->
  <div style="padding:20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
    <div style="display:flex;align-items:center;gap:10px;">
      <svg style="width:22px;height:22px;color:#0f172a;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
      </svg>
      <h3 style="font-size:18px;font-weight:800;margin:0;">Shopping Cart</h3>
    </div>
    <button onclick="window.SBCart && window.SBCart.closeCart()" style="border:none;background:none;cursor:pointer;color:#64748b;font-size:24px;line-height:1;padding:4px 8px;border-radius:8px;">&times;</button>
  </div>

  <!-- Cart Items List -->
  <div id="sb-cart-items" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;">
    <!-- Items rendered dynamically -->
  </div>

  <!-- Cart Footer / Subtotal / Checkout -->
  <div style="padding:20px;border-top:1px solid #e2e8f0;background:#f8fafc;display:flex;flex-direction:column;gap:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:14px;color:#64748b;font-weight:600;">Subtotal</span>
      <span id="sb-cart-subtotal" style="font-size:20px;font-weight:800;color:#0f172a;">$0.00</span>
    </div>
    <p style="font-size:11px;color:#94a3b8;margin:0;">Taxes and shipping calculated during checkout.</p>
    <button id="sb-cart-checkout-btn" onclick="window.SBCart && window.SBCart.checkout()" style="width:100%;background:#0f172a;color:#ffffff;border:none;border-radius:14px;padding:14px;font-weight:700;font-size:15px;cursor:pointer;display:flex;justify-content:center;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(15,23,42,0.2);transition:background 0.2s;">
      Checkout &rarr;
    </button>
  </div>
</div>

<script>
(function() {
  const STORAGE_KEY = 'sb_cms_cart';
  let cart = [];

  function loadCart() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      cart = stored ? JSON.parse(stored) : [];
    } catch (e) {
      cart = [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {}
    renderCart();
  }

  function renderCart() {
    const listEl = document.getElementById('sb-cart-items');
    const badgeEl = document.getElementById('sb-cart-badge');
    const subtotalEl = document.getElementById('sb-cart-subtotal');
    const checkoutBtn = document.getElementById('sb-cart-checkout-btn');

    const totalCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const subtotalCents = cart.reduce((sum, item) => sum + ((item.priceCents || 0) * (item.quantity || 1)), 0);

    if (badgeEl) {
      badgeEl.innerText = totalCount;
      badgeEl.style.display = totalCount > 0 ? 'inline-block' : 'none';
    }

    if (subtotalEl) {
      subtotalEl.innerText = '$' + (subtotalCents / 100).toFixed(2);
    }

    if (checkoutBtn) {
      checkoutBtn.disabled = cart.length === 0;
      checkoutBtn.style.opacity = cart.length === 0 ? '0.5' : '1';
      checkoutBtn.style.cursor = cart.length === 0 ? 'not-allowed' : 'pointer';
    }

    if (!listEl) return;

    if (cart.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:40px 10px;color:#94a3b8;font-size:13px;font-weight:600;"><p style="font-size:28px;margin-bottom:8px;">🛒</p>Your cart is empty</div>';
      return;
    }

    listEl.innerHTML = cart.map((item, index) => {
      const itemTotal = ((item.priceCents * item.quantity) / 100).toFixed(2);
      const customFieldEntries = item.customFields ? Object.entries(item.customFields).filter(([_, v]) => v !== undefined && v !== null && v !== false && String(v).trim() !== '') : [];
      let customFieldsHtml = '';
      if (customFieldEntries.length > 0) {
        const rows = customFieldEntries.map(([k, val]) => 
          '<div style="line-height:1.2;"><span style="font-weight:700;color:#475569;">' + k + ':</span> <span style="color:#0f172a;word-break:break-word;">' + (val === true ? 'Yes' : String(val)) + '</span></div>'
        ).join('');
        customFieldsHtml = '<div style="margin-top:6px;display:flex;flex-direction:column;gap:3px;background:#ffffff;padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:11px;">' + rows + '</div>';
      }
      const imgHtml = item.image 
        ? '<img src="' + item.image + '" style="width:52px;height:72px;object-fit:cover;border-radius:8px;flex-shrink:0;box-shadow:0 2px 4px rgba(0,0,0,0.1);" />' 
        : '<div style="width:52px;height:72px;background:#e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#64748b;flex-shrink:0;">No Img</div>';

      return '<div style="display:flex;gap:12px;align-items:flex-start;padding:12px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">' +
        imgHtml +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-weight:700;font-size:13px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + item.name + '</div>' +
          '<div style="font-size:12px;color:#64748b;margin-top:2px;">$' + (item.priceCents / 100).toFixed(2) + ' each</div>' +
          customFieldsHtml +
          '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">' +
            '<button onclick="window.SBCart.updateQuantity(' + index + ', ' + (item.quantity - 1) + ')" style="width:24px;height:24px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;cursor:pointer;font-weight:bold;line-height:1;display:flex;align-items:center;justify-content:center;">-</button>' +
            '<span style="font-size:12px;font-weight:700;">' + item.quantity + '</span>' +
            '<button onclick="window.SBCart.updateQuantity(' + index + ', ' + (item.quantity + 1) + ')" style="width:24px;height:24px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;cursor:pointer;font-weight:bold;line-height:1;display:flex;align-items:center;justify-content:center;">+</button>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">' +
          '<span style="font-weight:800;font-size:13px;color:#0f172a;">$' + itemTotal + '</span>' +
          '<button onclick="window.SBCart.removeItem(' + index + ')" style="border:none;background:none;color:#ef4444;font-size:11px;font-weight:600;cursor:pointer;padding:2px 4px;">Remove</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  window.SBCart = {
    openCart() {
      const drawer = document.getElementById('sb-cart-drawer');
      const backdrop = document.getElementById('sb-cart-drawer-backdrop');
      if (drawer) drawer.style.right = '0';
      if (backdrop) {
        backdrop.style.opacity = '1';
        backdrop.style.pointerEvents = 'auto';
      }
    },
    closeCart() {
      const drawer = document.getElementById('sb-cart-drawer');
      const backdrop = document.getElementById('sb-cart-drawer-backdrop');
      if (drawer) drawer.style.right = '-420px';
      if (backdrop) {
        backdrop.style.opacity = '0';
        backdrop.style.pointerEvents = 'none';
      }
    },
    addItem(product, customFields) {
      loadCart();
      const fields = (customFields && typeof customFields === 'object') ? customFields : (product.customFields || null);
      const fieldsStr = fields ? JSON.stringify(fields) : '';
      
      const existing = cart.find(i => i.id === product.id && (JSON.stringify(i.customFields || '') === (fields ? JSON.stringify(fields) : '')));
      if (existing) {
        existing.quantity = (existing.quantity || 1) + (product.quantity || 1);
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          priceCents: product.priceCents,
          image: product.image || '',
          quantity: product.quantity || 1,
          customFields: fields
        });
      }
      saveCart();
      this.openCart();
    },
    updateQuantity(index, newQty) {
      loadCart();
      if (newQty <= 0) {
        cart.splice(index, 1);
      } else {
        cart[index].quantity = newQty;
      }
      saveCart();
    },
    removeItem(index) {
      loadCart();
      cart.splice(index, 1);
      saveCart();
    },
    async checkout() {
      loadCart();
      if (cart.length === 0) return;
      const btn = document.getElementById('sb-cart-checkout-btn');
      if (btn) {
        btn.disabled = true;
        btn.innerText = 'Redirecting to Checkout...';
      }
      if (window.trackCMSConversion) {
        window.trackCMSConversion('checkout_start');
      }
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map(item => ({
              productId: item.id,
              quantity: item.quantity,
              customFields: item.customFields || undefined
            }))
          })
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert(data.message || 'Checkout initiation failed.');
          if (btn) {
            btn.disabled = false;
            btn.innerText = 'Checkout \u2192';
          }
        }
      } catch (err) {
        console.error('Checkout error:', err);
        alert('An error occurred starting checkout.');
        if (btn) {
          btn.disabled = false;
          btn.innerText = 'Checkout \u2192';
        }
      }
    },
    async buyNow(product, customFields) {
      if (window.trackCMSConversion) {
        window.trackCMSConversion('checkout_start');
      }
      const fields = (customFields && typeof customFields === 'object') ? customFields : (product.customFields || undefined);
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: product.id,
            quantity: 1,
            customFields: fields,
            items: [{
              productId: product.id,
              quantity: 1,
              customFields: fields
            }]
          })
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert(data.message || 'Checkout initiation failed.');
        }
      } catch (err) {
        console.error('Buy Now error:', err);
        alert('An error occurred starting checkout.');
      }
    }
  };

  // Initial load
  loadCart();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCart);
  } else {
    renderCart();
  }
})();
</script>
`;
}
