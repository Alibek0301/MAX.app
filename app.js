const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// UI Elements (Headers & Containers)
const loader = document.getElementById('loader');
const mainHeader = document.getElementById('main-header');
const userNameEl = document.getElementById('user-name');
const userAvatarEl = document.getElementById('user-avatar');
const roleBadgeEl = document.getElementById('role-badge');
const tabsContainer = document.getElementById('tabs-container');
const bottomNav = document.getElementById('bottom-nav');

// Core Role Views (Inside Home Tab)
const adminView = document.getElementById('admin-view');
const dispatcherView = document.getElementById('dispatcher-view');
const driverView = document.getElementById('driver-view');
const clientView = document.getElementById('client-view');

let currentActiveRole = 'client'; // To know which orders to render in Rides Tab

// Telegram Identification — priority: URL param > initDataUnsafe > test
const urlSearchParams = new URLSearchParams(window.location.search);
const uidFromUrl = urlSearchParams.get('uid');
const telegramId = uidFromUrl
    ? parseInt(uidFromUrl)
    : ((tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user.id : 123456789);
const firstName = (tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user.first_name : (uidFromUrl ? 'Пользователь' : 'Тест');

userNameEl.textContent = firstName;
const bgColor = tg.themeParams.button_color ? tg.themeParams.button_color.replace('#', '') : 'f4c01e';
userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName)}&background=${bgColor}&color=fff&bold=true`;

// Let's implement Bottom Navigation Logic first
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Haptic 
        if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();

        // Remove active class from all iterems
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Hide all tabs
        tabContents.forEach(tab => tab.classList.add('hidden'));

        // Show target tab
        const targetId = item.getAttribute('data-tab');
        document.getElementById(targetId).classList.remove('hidden');
    });
});

// Fetch Data
async function initApp() {
    try {
        const urlParams = window.location.search;
        const response = await fetch(`https://swimsuit-sheath-viewless.ngrok-free.dev/api/user/${telegramId}${urlParams}`, {
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        });
        const data = await response.json();

        loader.classList.add('hidden');
        mainHeader.classList.remove('hidden');
        tabsContainer.classList.remove('hidden');
        bottomNav.classList.remove('hidden'); // Show bottom navigation natively!

        const role = data.role;
        currentActiveRole = role;
        roleBadgeEl.textContent = getRoleName(role);

        // Hide "Become Driver" button if user is already a driver or higher
        if (role !== 'client') {
            const btnBecomeDriver = document.getElementById('btn-become-driver');
            if (btnBecomeDriver) btnBecomeDriver.classList.add('hidden');
        }

        // Save globally to use in assigning/admin UI
        window.fleetDrivers = data.drivers || [];

        if (role === 'admin') {
            adminView.classList.remove('hidden');
            dispatcherView.classList.remove('hidden');
            driverView.classList.remove('hidden');

            document.getElementById('stat-users').textContent = data.stats ? data.stats.users : 0;
            document.getElementById('stat-drivers').textContent = data.stats ? data.stats.drivers : 0;
            document.getElementById('stat-transfers').textContent = data.stats ? data.stats.transfers : 0;

            renderAdminDrivers();
            renderOrders(data.new_orders, 'dispatcher-orders');
            renderOrders(data.active_orders, 'active-orders-container');

        } else if (role === 'dispatcher') {
            dispatcherView.classList.remove('hidden');
            renderOrders(data.new_orders, 'dispatcher-orders');

            // Populate rides tab with active fleet rides (mocking with new orders for visual)
            renderOrders(data.new_orders, 'active-orders-container');

        } else if (role === 'driver') {
            driverView.classList.remove('hidden');
            const balanceEl = document.getElementById('balance');
            if (window.driverData) {
                const bal = parseInt(window.driverData.balance) || 0;
                balanceEl.textContent = bal + ' ₸';
                if (bal < 0) {
                    balanceEl.style.background = 'none';
                    balanceEl.style.webkitTextFillColor = '#ff5252';
                    const bt = document.querySelector('.balance-title');
                    if (bt) bt.textContent = 'Долг по комиссии (К ОПЛАТЕ)';
                } else {
                    balanceEl.style.background = 'linear-gradient(90deg, #fff, var(--accent-color))';
                    balanceEl.style.webkitTextFillColor = 'transparent';
                    const bt = document.querySelector('.balance-title');
                    if (bt) bt.textContent = 'Доступно к выводу';
                }
            } else {
                balanceEl.textContent = '0 ₸';
            }
            

            // Show driver statistical blocks in Rides tab
            const statsContainer = document.getElementById('driver-stats-container');
            if (statsContainer) statsContainer.classList.remove('hidden');

            // Populate BOTH the inner module and the central Rides Tab
            renderOrders(data.active_orders, 'active-orders-container');

        } else {
            // Client
            clientView.classList.remove('hidden');
            renderOrders(data.active_orders, 'active-orders-container'); // Move to rides tab
        }
    } catch (error) {
        // Fallback Client Mock
        loader.classList.add('hidden');
        mainHeader.classList.remove('hidden');
        tabsContainer.classList.remove('hidden');
        bottomNav.classList.remove('hidden');
        roleBadgeEl.textContent = 'Клиент (Демо)';
        clientView.classList.remove('hidden');
        renderOrders([
            { id: 792, from_address: 'ТЦ Хан Шатыр', to_address: 'Дом', date: 'Завтра', time: '18:00', status: 'Создан' }
        ], 'active-orders-container');
    }
}

function getRoleName(role) {
    if (role === 'admin') return 'Администратор';
    if (role === 'dispatcher') return 'Диспетчер Парка';
    if (role === 'driver') return 'Водитель (MAX FLEET)';
    return 'Клиент';
}

function renderOrders(orders, containerId) {
    const container = document.getElementById(containerId);
    if (!orders || orders.length === 0) {
        container.innerHTML = '<div class="empty-msg">Здесь пока пусто. Активных поездок нет.</div>';
        return;
    }

    let html = '';
    orders.forEach(o => {
        let statusColor = '#a1a1a1';
        let prettyStatus = o.status;
        if (o.status === 'new') { prettyStatus = 'Новый'; statusColor = 'var(--accent-color)'; }
        else if (o.status === 'assigned') { prettyStatus = 'Назначен'; statusColor = '#4CAF50'; }
        else if (['going', 'waiting', 'in_progress'].includes(o.status)) { prettyStatus = 'В процессе'; statusColor = '#2196F3'; }

        html += `
            <div class="order-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <h4>Заказ #${o.id}</h4>
                    <span style="font-size:11px; padding:2px 8px; border-radius:12px; border:1px solid ${statusColor}; color:${statusColor};">${prettyStatus}</span>
                </div>
                <p style="margin-bottom:3px;">👤 ${o.name} (${o.phone})</p>
                <p style="margin-bottom:3px;">📍 ${o.from_address} ➡️ ${o.to_address}</p>
                <p style="margin-bottom:3px;">🕒 ${o.date} ${o.time} • ${o.car_class || 'Эконом'}</p>
                ${o.driver_id ? `<p style="margin-bottom:3px; color:var(--accent-color);">🚕 Водитель: ID ${o.driver_id}</p>` : ''}
                ${currentActiveRole === 'client' ? `<button class="repeat-order-btn" onclick="repeatOrder(${o.id}, '${o.from_address}', '${o.to_address}')">Повторить</button>` : ''}
                ${(currentActiveRole === 'driver' || currentActiveRole === 'dispatcher') && o.phone ? `<a href="tel:${o.phone}" class="primary-btn alt-btn" style="display:inline-block; text-decoration:none; margin-top:10px; padding:6px 12px; font-size:12px; width:auto; border: 1px solid var(--accent-color); color:var(--accent-color);">📞 Позв. клиенту</a>` : ''}
                ${currentActiveRole === 'dispatcher' && (o.status === 'new' || o.status === 'pending_client') ? `<button class="primary-btn pulse-btn" style="margin-top:10px; padding:8px 12px; font-size:12px; width:auto;" onclick="openAssignModal(${o.id})">Назначить водителя</button>` : ''}
                ${currentActiveRole === 'dispatcher' && o.status !== 'completed' && o.status !== 'cancelled' ? `<button class="primary-btn alt-btn" style="margin-top:10px; margin-left:5px; padding:8px 12px; font-size:12px; width:auto; border: 1px solid #ff5252; color:#ff5252;" onclick="cancelOrder(${o.id})">Отменить (✕)</button>` : ''}
            </div>
        `;
    });
    container.innerHTML = html;
}

function repeatOrder(id, from, to) {
    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    const tabHome = document.querySelector('[data-tab="tab-home"]');
    if (tabHome) tabHome.click();

    // Fill the addresses
    const pickup = document.getElementById('client-pickup');
    const dropoff = document.getElementById('client-dropoff');

    if (pickup && dropoff) {
        pickup.value = from;
        dropoff.value = to;
        pickup.dispatchEvent(new Event('input'));
    }
}

// --- DISPATCHER LOGIC ---
let activeAssignOrderId = null;
let selectedDriverId = null;

function openAssignModal(orderId) {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    activeAssignOrderId = orderId;
    selectedDriverId = null;

    // Fill driver list
    const container = document.getElementById('driver-list-container');
    let html = '';
    // Filter to only allowed drivers
    const drivers = (window.fleetDrivers || []).filter(d => d.status === 'active');

    if (drivers.length === 0) {
        container.innerHTML = '<div class="empty-msg">Нет свободных водителей или у всех статус "Отстранен"</div>';
    } else {
        drivers.forEach(d => {
            const driverName = d.driver_name || d.first_name || 'Водитель';
            const carInfo = d.car_brand ? `${d.car_brand} • <b>${d.car_number || ''}</b>` : 'Нет авто';
            html += `
                <div class="driver-list-item" onclick="selectDriverForAssign(this, ${d.telegram_id})" id="drv-item-${d.telegram_id}">
                    <div>
                        <h4 style="font-size:13px; margin-bottom:2px;">${driverName}</h4>
                        <p style="font-size:11px; color:var(--hint-color);">${carInfo}</p>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    document.getElementById('assign-driver-modal').classList.remove('hidden');
    document.getElementById('assign-driver-modal').classList.remove('hidden');
    document.getElementById('confirm-assign-btn').disabled = true;
}

function cancelOrder(orderId) {
    tg.showConfirm('Вы уверены, что хотите отменить этот заказ? Уведомление об отмене будет отправлено.', async function (confirmed) {
        if (confirmed) {
            try {
                if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
                const baseUrl = window.location.origin.includes('github.io') ? 'https://swimsuit-sheath-viewless.ngrok-free.dev' : window.location.origin;
                const response = await fetch(baseUrl + "/api/transfer/" + orderId + "/cancel", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify({ caller_id: telegramId })
                });
                const res = await response.json();
                if (res.success) {
                    tg.showAlert('Заказ успешно отменен!');
                    setTimeout(() => initApp(), 1000);
                } else {
                    tg.showAlert('Ошибка при отмене!');
                }
            } catch (e) {
                tg.showAlert('Сбой сети при отмене!');
            }
        }
    });
}

function selectDriverForAssign(el, driverId) {
    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    selectedDriverId = driverId;
    document.querySelectorAll('.driver-list-item').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('confirm-assign-btn').disabled = false;
}

function closeAssignModal() {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    document.getElementById('assign-driver-modal').classList.add('hidden');
    activeAssignOrderId = null;
    selectedDriverId = null;
}

function confirmAssignDriver() {
    if (!selectedDriverId || !activeAssignOrderId) return;
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');

    closeAssignModal();
    tg.sendData(JSON.stringify({
        action: 'assign_driver',
        order_id: activeAssignOrderId,
        driver_id: selectedDriverId
    }));
    tg.showAlert('Водитель успешно назначен на рейс!');
}

function setupDriverWithdraw() {
    const input = document.getElementById('withdraw-amount');
    const btn = document.getElementById('withdraw-btn');
    if (!input || !btn) return;

    input.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (val > 0 && val <= 12500) {
            btn.disabled = false;
        } else {
            btn.disabled = true;
        }
    });

    btn.addEventListener('click', () => {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        tg.showConfirm(`Вывести ${input.value} ₸?`, (ok) => {
            if (ok) tg.sendData(JSON.stringify({ action: 'withdraw', amount: input.value }));
        });
    });
}

// --- CLIENT UI LOGIC ---
const clientPickup = document.getElementById('client-pickup');
const clientDropoff = document.getElementById('client-dropoff');
const clientOrderBtn = document.getElementById('client-order-btn');
const carCards = document.querySelectorAll('.car-card');
const clientComment = document.getElementById('client-comment');
const clientDate = document.getElementById('client-date');
const clientTime = document.getElementById('client-time');
const clientFrequency = document.getElementById('client-frequency');
const clientRentType = document.getElementById('client-rent-type');
const clientPassengers = document.getElementById('client-passengers');
const clientReturnCheck = document.getElementById('client-return-check');
const clientReturnDate = document.getElementById('client-return-date');
const clientReturnTime = document.getElementById('client-return-time');
const clientDuration = document.getElementById('client-duration');

// UI Blocks
const wrapDropoff = document.getElementById('wrap-dropoff');
const blockFrequency = document.getElementById('block-frequency');
const blockDays = document.getElementById('block-days');
const blockReturn = document.getElementById('block-return');
const returnParams = document.getElementById('return-params');
const wrapPassengers = document.getElementById('wrap-passengers');
const wrapDuration = document.getElementById('wrap-duration');
const addressLine = document.getElementById('address-line');

let clientSelectedClass = 'standart';

if (clientPickup) {
    if (clientDate) clientDate.valueAsDate = new Date();

    // Rent Type logic
    clientRentType.addEventListener('change', (e) => {
        if (e.target.value === 'hourly') {
            wrapDropoff.classList.add('hidden');
            addressLine.classList.add('hidden');
            blockFrequency.classList.add('hidden');
            blockDays.classList.add('hidden');
            blockReturn.classList.add('hidden');
            wrapPassengers.classList.add('hidden');
            wrapDuration.classList.remove('hidden');
            clientPickup.placeholder = 'Место подачи (адрес)';
        } else {
            wrapDropoff.classList.remove('hidden');
            addressLine.classList.remove('hidden');
            blockFrequency.classList.remove('hidden');
            blockReturn.classList.remove('hidden');
            wrapPassengers.classList.remove('hidden');
            wrapDuration.classList.add('hidden');
            clientPickup.placeholder = 'Откуда поедем?';
            clientFrequency.dispatchEvent(new Event('change'));
        }
        validateClientOrder();
    });

    // Frequency Logic
    clientFrequency.addEventListener('change', (e) => {
        if (e.target.value === 'schedule') {
            blockDays.classList.remove('hidden');
        } else {
            blockDays.classList.add('hidden');
        }
    });

    // Return trip logic
    clientReturnCheck.addEventListener('change', (e) => {
        if (e.target.checked) {
            returnParams.classList.remove('hidden');
        } else {
            returnParams.classList.add('hidden');
        }
    });

    function validateClientOrder() {
        let isValid = clientPickup.value.trim() !== '';

        if (clientRentType.value === 'transfer') {
            if (clientDropoff.value.trim() === '') isValid = false;
        }

        if (isValid) {
            clientOrderBtn.disabled = false;
        } else {
            clientOrderBtn.disabled = true;
        }
    }

    clientPickup.addEventListener('input', validateClientOrder);
    if (clientDropoff) clientDropoff.addEventListener('input', validateClientOrder);

    carCards.forEach(card => {
        card.addEventListener('click', () => {
            if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
            carCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            clientSelectedClass = card.getAttribute('data-class');
        });
    });

    clientOrderBtn.addEventListener('click', () => {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');

        // Collect selected days if schedule
        let scheduleDays = [];
        if (clientFrequency.value === 'schedule' && clientRentType.value === 'transfer') {
            document.querySelectorAll('.day-check:checked').forEach(el => scheduleDays.push(el.value));
        }

        tg.sendData(JSON.stringify({
            action: 'client_order',
            rent_type: clientRentType.value,
            pickup: clientPickup.value.trim(),
            dropoff: clientRentType.value === 'transfer' ? clientDropoff.value.trim() : '',
            date: clientDate.value,
            time: clientTime ? clientTime.value : '',
            frequency: clientRentType.value === 'transfer' ? clientFrequency.value : 'once',
            schedule_days: scheduleDays.join(','),
            return_trip: clientReturnCheck.checked ? '1' : '0',
            return_date: clientReturnCheck.checked ? clientReturnDate.value : '',
            return_time: clientReturnCheck.checked ? clientReturnTime.value : '',
            duration_hours: clientRentType.value === 'hourly' ? clientDuration.value : 0,
            passengers: clientRentType.value === 'transfer' ? clientPassengers.value : 0,
            carClass: clientSelectedClass,
            comment: clientComment.value.trim()
        }));
    });
}

// --- YANDEX SYNC LOGIC ---
const syncStep1 = document.getElementById('driver-sync-step-1');
const syncStep2 = document.getElementById('driver-sync-step-2');
const syncStep3 = document.getElementById('driver-sync-step-3');
const syncBtnCheck = document.getElementById('sync-btn-check');
const syncPhone = document.getElementById('sync-phone');

if (syncBtnCheck) {
    syncBtnCheck.addEventListener('click', () => {
        if (syncPhone.value.trim().length >= 10) {
            syncStep1.classList.add('hidden');
            syncStep2.classList.remove('hidden');
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

            // Mock API Sync delay
            setTimeout(() => {
                syncStep2.classList.add('hidden');
                syncStep3.classList.remove('hidden');
                if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');

                tg.sendData(JSON.stringify({
                    action: 'yandex_sync',
                    phone: syncPhone.value.trim()
                }));
            }, 3000); // 3 seconds fake sync

        } else {
            tg.showAlert('Пожалуйста, введите корректный номер телефона.');
        }
    });
}

// Kickstart
initApp();


// --- ADMIN LOGIC ---
function renderAdminDrivers() {
    const container = document.getElementById('admin-drivers-list');
    if (!container) return;

    let html = '';
    const drivers = window.fleetDrivers || [];

    if (drivers.length === 0) {
        container.innerHTML = '<div class="empty-msg">Нет водителей в базе</div>';
        return;
    }

    drivers.forEach(d => {
        const isAllowed = d.status === "active";
        const toggleColor = isAllowed ? '#4CAF50' : 'var(--hint-color)';
        const btnText = isAllowed ? 'Отстранить' : 'Допустить';
        const statusText = isAllowed ? 'Допущен к трансферам' : 'Не допущен';
        const driverName = d.driver_name || d.first_name || 'Водитель';
        const carInfo = d.car_brand ? `${d.car_brand} • ${d.car_number || ''}` : 'Нет авто';

        html += `
            <div class="glass-card" style="margin-bottom:10px; padding:15px; border-left: 4px solid ${toggleColor};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h4 style="font-size:15px; margin-bottom:5px;">${driverName}</h4>
                        <p style="font-size:12px; color:var(--hint-color); margin-bottom:2px;">${carInfo}</p>
                        <p style="font-size:11px; color:${toggleColor}; font-weight:600;">${statusText}</p>
                    </div>
                    <button class="primary-btn alt-btn" style="width:auto; padding:8px 12px; font-size:11px;" onclick="toggleDriverAccess(${d.telegram_id})">${btnText}</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

async function toggleDriverAccess(driverId) {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    try {
        const response = await fetch("https://swimsuit-sheath-viewless.ngrok-free.dev/api/driver/" + driverId + "/toggle", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ caller_id: telegramId })
        });
        const result = await response.json();
        if (result.success) {
            // Update local state
            const drv = window.fleetDrivers.find(d => d.telegram_id === driverId);
            if (drv) drv.status = result.new_status;
            renderAdminDrivers();
        } else {
            tg.showAlert('Ошибка: ' + result.error);
        }
    } catch (e) {
        tg.showAlert('Ошибка сети при изменении статуса');
    }
}
