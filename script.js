// script.js - God Level Frontend Logic connected to PHP APIs

let currentUser = null;
let currentProducts = [];
let activeChatProduct = null;
let activeChatReceiver = null;
let chatRefreshTimer = null;

// DOM Elements
const authModal = document.getElementById('authModal');
const sellModal = document.getElementById('sellModal');
const productModal = document.getElementById('productModal');
const chatModal = document.getElementById('chatModal');
const checkoutModal = document.getElementById('checkoutModal');
const receiptModal = document.getElementById('receiptModal');

// Init App
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await fetchProducts();
    setupEventListeners();
});

// Toast System
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    if (isError) toast.classList.add('error');
    else toast.classList.remove('error');
    
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// Check Session state securely
async function checkAuth() {
    try {
        const res = await fetch('api/auth_status.php');
        const data = await res.json();
        const navActions = document.getElementById('navActions');
        const sidebarStats = document.getElementById('sidebarStats');
        
        if (data.authenticated) {
            currentUser = data.user;
            navActions.innerHTML = `
                <button class="btn btn-primary" id="openSellBtn">
                    <ion-icon name="add-circle-outline"></ion-icon> Sell Item
                </button>
                <div class="user-profile" onclick="logout()">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.name}" alt="User Profile" class="avatar">
                    <div class="user-info">
                        <span class="user-name">${currentUser.name}</span>
                        <span class="user-badge" style="color:var(--danger-color); font-size:0.75rem;"><ion-icon name="log-out-outline"></ion-icon> Log Out</span>
                    </div>
                </div>
            `;
            document.getElementById('openSellBtn').addEventListener('click', () => openModal(sellModal));
            
            sidebarStats.style.display = 'block';
            document.getElementById('trustName').textContent = currentUser.name;
            document.getElementById('welcomeText').innerHTML = `Welcome back, <span style="color:var(--primary-color)">${currentUser.name.split(' ')[0]}</span>.`;
        } else {
            currentUser = null;
            navActions.innerHTML = `
                <button class="btn btn-outline" id="openLoginBtn">
                    <ion-icon name="log-in-outline"></ion-icon> Sign In
                </button>
            `;
            document.getElementById('openLoginBtn').addEventListener('click', () => {
                showLoginForm();
                openModal(authModal);
            });
            sidebarStats.style.display = 'none';
            document.getElementById('welcomeText').textContent = 'Welcome to CampusTrade';
        }
    } catch (err) { console.error("Auth check failed.", err); }
}

// Authenticaton functions
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await fetch('api/login.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                email: document.getElementById('loginEmail').value, 
                password: document.getElementById('loginPassword').value 
            })
        });
        const data = await res.json();
        if (res.ok) {
            closeAllModals();
            showToast(data.message);
            await checkAuth(); 
        } else {
            showToast(data.message, true);
        }
    } catch (e) { showToast("Network Error", true); }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await fetch('api/register.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                full_name: document.getElementById('regName').value, 
                email: document.getElementById('regEmail').value, 
                password: document.getElementById('regPassword').value 
            })
        });
        const data = await res.json();
        if (res.ok) {
            closeAllModals();
            showToast("Secure Registration Successful!");
            await checkAuth(); 
        } else {
            showToast(data.message, true);
        }
    } catch (e) { showToast("Network Error", true); }
});

async function logout() {
    try {
        await fetch('api/logout.php');
        showToast("Logged out successfully");
        await checkAuth();
    } catch(e) { console.error(e); }
}

// Product Management
async function fetchProducts(category = 'all', search = '') {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '<p style="color:var(--secondary-color);">Loading live items from campus...</p>';
    
    try {
        const queryParams = new URLSearchParams();
        if (category !== 'all') queryParams.append('category', category);
        if (search) queryParams.append('search', search);

        const res = await fetch(`api/products.php?${queryParams.toString()}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            currentProducts = data.data;
            renderProducts(currentProducts, grid);
        } else {
            grid.innerHTML = '<p style="color:var(--danger-color);">Error loading products.</p>';
        }
    } catch (err) { grid.innerHTML = '<p style="color:var(--danger-color);">Network Error</p>'; }
}

document.getElementById('sellForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUser) return showToast("You must be logged in to sell.", true);

    const payload = {
        title: document.getElementById('sellTitle').value,
        price: document.getElementById('sellPrice').value,
        category: document.getElementById('sellCategory').value,
        description: document.getElementById('sellDesc').value,
        safe_zone: true
    };

    try {
        const res = await fetch('api/products.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            closeAllModals();
            showToast("Item securely posted to campus marketplace!");
            document.getElementById('sellForm').reset();
            fetchProducts(); 
        } else {
            showToast(data.message, true);
        }
    } catch (err) { showToast("Network error", true); }
});

function renderProducts(items, containerElement) {
    containerElement.innerHTML = '';
    
    if (items.length === 0) {
        containerElement.innerHTML = '<p style="color: var(--secondary-color); grid-column: 1/-1; text-align: center; padding: 3rem;">No items found. Be the first to post!</p>';
        return;
    }

    items.forEach(item => {
        const isSafeZone = parseInt(item.is_safe_zone) === 1;
        const safeZoneHtml = isSafeZone ? `<div class="safe-zone-badge"><ion-icon name="shield-checkmark"></ion-icon> Safe Zone</div>` : '';

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="card-img-wrapper" style="background:#000;">
                ${safeZoneHtml}
                <img src="${item.image_url}" alt="${item.title}" class="card-img" onerror="this.src='https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=400&auto=format&fit=crop'">
            </div>
            <div class="card-content">
                <span class="card-category">${item.category}</span>
                <h3 class="card-title">${item.title}</h3>
                <div class="card-price">₹${item.price}</div>
                <div class="card-footer">
                    <div class="card-seller">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${item.seller_name}">
                        <span>${item.seller_name}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--success-light); display: flex; align-items: center; gap: 0.2rem;">
                        <ion-icon name="star"></ion-icon> ${item.trust_score}
                    </div>
                </div>
            </div>
        `;
        // Store item data as JSON string to easily parse onclick
        card.setAttribute('data-item', JSON.stringify(item));
        card.addEventListener('click', function() {
            const productData = JSON.parse(this.getAttribute('data-item'));
            openProductViewModal(productData);
        });
        containerElement.appendChild(card);
    });
}

// =========================================
// Advanced x100 Hackathon Logic: Chat, Checkout, Recommendations
// =========================================

async function openProductViewModal(item) {
    const isSafeZone = parseInt(item.is_safe_zone) === 1;
    const isOwner = currentUser && (parseInt(item.seller_id) === parseInt(currentUser.id));
    
    let actionButtons = '';
    if (!currentUser) {
        actionButtons = `<button class="btn btn-outline btn-full" onclick="openModal(authModal); productModal.classList.remove('active');">Sign in to Buy/Chat</button>`;
    } else if (isOwner) {
        actionButtons = `<button class="btn btn-outline btn-full" disabled>This is your item</button>`;
    } else {
        actionButtons = `
            <button class="btn btn-outline btn-full" onclick='startChat(${item.id}, ${item.seller_id}, "${item.seller_name}", "${item.title.replace(/"/g, '')}")'><ion-icon name="chatbubbles"></ion-icon> Negotiate</button>
            <button class="btn btn-primary btn-full" onclick='startCheckout(${JSON.stringify(item).replace(/'/g, "&#39;")})'><ion-icon name="card"></ion-icon> Buy Now (₹${item.price})</button>
        `;
    }

    document.getElementById('modalBody').innerHTML = `
        <div class="modal-grid">
            <img src="${item.image_url}" class="modal-img" onerror="this.src='https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=800&auto=format&fit=crop'">
            <div class="modal-info">
                <span class="card-category">${item.category}</span>
                <h2 class="modal-title">${item.title}</h2>
                <div class="card-price" style="font-size: 2rem;">₹${item.price}</div>
                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                    <span style="background: rgba(46, 160, 67, 0.2); color: var(--success-light); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">
                        <ion-icon name="checkmark-circle"></ion-icon> Condition: ${item.condition_status || 'Good'}
                    </span>
                    ${isSafeZone ? `
                    <span style="background: rgba(88, 166, 255, 0.2); color: var(--primary-color); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">
                        <ion-icon name="location"></ion-icon> Safe Zone Exchange
                    </span>` : ''}
                </div>
                <h3>Description</h3>
                <p class="modal-desc">${item.description}</p>
                <div class="trust-widget" style="margin-bottom: 2rem;">
                    <h3 style="font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--secondary-color);">Seller Profile</h3>
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div class="card-seller">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${item.seller_name}" style="width: 40px; height: 40px;">
                            <div>
                                <strong style="color: var(--text-light); display: block;">${item.seller_name}</strong>
                                <span style="color: var(--success-light); font-size: 0.75rem;"><ion-icon name="shield-checkmark"></ion-icon> Verified Student ID</span>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <strong style="color: var(--success-light); font-size: 1.2rem;">${item.trust_score}/5.0</strong>
                            <span style="display:block; font-size: 0.7rem; color: var(--secondary-color);">Trust Score</span>
                        </div>
                    </div>
                </div>
                <div class="modal-actions" style="gap:1rem;">${actionButtons}</div>
            </div>
        </div>
        <div style="padding: 2rem; border-top: 1px solid var(--glass-border);">
            <h3>Similar Campus Deals</h3>
            <div class="grid" id="recommendationsGrid" style="margin-top:1rem; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
                <p style="color:var(--secondary-color);font-size:0.9rem;">Fetching AI recommendations...</p>
            </div>
        </div>
    `;
    
    openModal(productModal);

    // Fetch Recommendations (Bonus Deliverable)
    try {
        const res = await fetch(`api/products.php?category=${item.category}&exclude_id=${item.id}&limit=3`);
        const recData = await res.json();
        if (recData.status === 'success') {
            const recGrid = document.getElementById('recommendationsGrid');
            if(recData.data.length === 0) recGrid.innerHTML = '<p style="color:var(--secondary-color);font-size:0.9rem;">No similar items found currently.</p>';
            else renderProducts(recData.data, recGrid);
        }
    } catch (e) { console.error("Rec failed"); }
}

// ---- CHAT LOGIC ----
function startChat(productId, sellerId, sellerName, productTitle) {
    activeChatProduct = productId;
    activeChatReceiver = sellerId;
    document.getElementById('chatTitle').textContent = `Chat with ${sellerName}`;
    closeAllModals();
    openModal(chatModal);
    loadChatMessages();
    
    // Auto refresh chat for live feel (cleared when modal closes)
    if(chatRefreshTimer) clearInterval(chatRefreshTimer);
    chatRefreshTimer = setInterval(loadChatMessages, 3000);
}

async function loadChatMessages() {
    if(!activeChatProduct || !activeChatReceiver) return;
    try {
        const res = await fetch(`api/chat.php?product_id=${activeChatProduct}&other_user_id=${activeChatReceiver}`);
        const data = await res.json();
        const chatBox = document.getElementById('chatMessages');
        
        if (data.status === 'success') {
            chatBox.innerHTML = '';
            if (data.data.length === 0) {
                chatBox.innerHTML = '<p style="color:var(--secondary-color); text-align:center; font-size:0.9rem;">Say hello! Start the negotiation securely.</p>';
            }
            data.data.forEach(msg => {
                const isMe = parseInt(msg.sender_id) === parseInt(currentUser.id);
                const bubbleClass = isMe ? 'chat-me' : 'chat-other';
                const time = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                chatBox.innerHTML += `
                    <div class="chat-msg ${bubbleClass}">
                        ${msg.message_text}
                        <div class="chat-meta">${time}</div>
                    </div>
                `;
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    } catch(e) { console.error('Chat load fail'); }
}

document.getElementById('chatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const msg = input.value;
    input.value = '';
    
    try {
        await fetch('api/chat.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ product_id: activeChatProduct, receiver_id: activeChatReceiver, message: msg })
        });
        loadChatMessages();
    } catch(e) {}
});

// ---- MOCK PAYMENT & DIGITAL BILL LOGIC ----
let checkoutProductData = null;

function startCheckout(product) {
    if(typeof product === 'string') product = JSON.parse(product);
    checkoutProductData = product;
    document.getElementById('checkoutAmount').textContent = `₹${product.price}`;
    closeAllModals();
    openModal(checkoutModal);
}

document.getElementById('paymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const rating = document.getElementById('checkoutRating').value;
    const btn = document.getElementById('payBtn');
    btn.innerHTML = '<ion-icon name="sync-outline" class="spin"></ion-icon> Processing...';
    btn.disabled = true;

    try {
        const res = await fetch('api/checkout.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                product_id: checkoutProductData.id, 
                seller_id: checkoutProductData.seller_id,
                card_number: document.getElementById('ccnum').value,
                rating: rating
            })
        });
        const data = await res.json();
        
        if (res.ok && data.status === 'success') {
            closeAllModals();
            showDigitalReceipt(data.digital_bill);
            fetchProducts(); // Refresh out the sold item globally
        } else {
            showToast(data.message, true);
        }
    } catch(e) { showToast("Payment failed due to Network error", true); }
    
    btn.innerHTML = '<ion-icon name="lock-closed"></ion-icon> Pay Securely';
    btn.disabled = false;
});

function showDigitalReceipt(bill) {
    document.getElementById('receiptId').textContent = bill.transaction_id;
    document.getElementById('receiptDate').textContent = bill.timestamp;
    document.getElementById('receiptAmount').textContent = `₹${bill.amount_paid}`;
    document.getElementById('receiptTrust').innerHTML = `${bill.seller_trust_updated} <ion-icon name="star"></ion-icon>`;
    
    openModal(receiptModal);
}

// Modal Helpers
function openModal(modalElement) {
    modalElement.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAllModals() {
    [authModal, sellModal, productModal, chatModal, checkoutModal, receiptModal].forEach(m => m.classList.remove('active'));
    document.body.style.overflow = 'auto';
    if(chatRefreshTimer) clearInterval(chatRefreshTimer); // Stop polling
}

function showLoginForm() {
    document.getElementById('loginFormContainer').style.display = 'block';
    document.getElementById('registerFormContainer').style.display = 'none';
}

function showRegisterForm() {
    document.getElementById('loginFormContainer').style.display = 'none';
    document.getElementById('registerFormContainer').style.display = 'block';
}

function setupEventListeners() {
    document.getElementById('showRegister').addEventListener('click', (e) => { e.preventDefault(); showRegisterForm(); });
    document.getElementById('showLogin').addEventListener('click', (e) => { e.preventDefault(); showLoginForm(); });

    // Category routing and searching
    document.querySelectorAll('.category-list li').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.category-list li').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            fetchProducts(item.getAttribute('data-category'), document.getElementById('searchInput').value);
        });
    });

    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const cat = document.querySelector('.category-list li.active').getAttribute('data-category');
            fetchProducts(cat, e.target.value);
        }, 300);
    });
}
