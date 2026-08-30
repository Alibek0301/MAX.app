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

        // Update Profile Tab
        document.getElementById('profile-name-large').textContent = firstName;
        document.getElementById('profile-role-large').textContent = getRoleName(role);
        document.getElementById('profile-avatar-large').src = userAvatarEl.src;

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
            renderOrders(data.history_orders, 'history-orders-container');

        } else if (role === 'dispatcher') {
            dispatcherView.classList.remove('hidden');
            renderOrders(data.new_orders, 'dispatcher-orders');

            document.getElementById('disp-stat-users').textContent = data.stats ? data.stats.users : 0;
            document.getElementById('disp-stat-drivers').textContent = data.stats ? data.stats.drivers : 0;
            document.getElementById('disp-stat-orders').textContent = data.stats ? data.stats.transfers : 0;

            // Populate rides tab with active fleet rides (mocking with new orders for visual)
            renderOrders(data.active_orders, 'active-orders-container');
            renderOrders(data.history_orders, 'history-orders-container');

        } else if (role === 'driver') {
            driverView.classList.remove('hidden');
            document.getElementById('profile-finance-driver').classList.remove('hidden');

            window.driverData = data.driver || null;
            window.driverTransactions = data.transactions || [];

            // Display Yandex Info if available
            if (window.driverData && window.driverData.yandex_id) {
                document.getElementById('driver-yandex-status-block').classList.remove('hidden');
                document.getElementById('driver-yandex-car').textContent = window.driverData.yandex_car || 'Автомобиль не привязан';
                let wkStatus = window.driverData.yandex_status === 'working' ? '🟢 На линии' : '🔴 Офлайн / ' + window.driverData.yandex_status;
                if (window.driverData.yandex_status === 'working') {
                    document.getElementById('driver-yandex-work-status').style.color = '#4CAF50';
                } else {
                    document.getElementById('driver-yandex-work-status').style.color = 'var(--hint-color)';
                }
                document.getElementById('driver-yandex-work-status').textContent = 'Статус Yandex: ' + (wkStatus || 'Неизвестно');
                document.getElementById('driver-yandex-id').textContent = 'ID: ' + window.driverData.yandex_id;
            }

            // Show driver statistical blocks in Rides tab
            const statsContainer = document.getElementById('driver-stats-container');
            if (statsContainer) statsContainer.classList.remove('hidden');

            // In home tab
            renderOrders(data.active_orders, 'driver-home-orders');
            // In rides tab
            renderOrders(data.active_orders, 'active-orders-container');
            renderOrders(data.history_orders, 'history-orders-container');

        } else {
            // Client
            clientView.classList.remove('hidden');
            document.getElementById('profile-finance-client').classList.remove('hidden');
            renderOrders(data.active_orders, 'active-orders-container');
            renderOrders(data.history_orders, 'history-orders-container');
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
        else if (o.status === 'completed') { prettyStatus = 'Завершен'; statusColor = '#9e9e9e'; }
        else if (o.status === 'cancelled') { prettyStatus = 'Отменен'; statusColor = '#ff5252'; }

        let driverDisplay = `ID ${o.driver_id}`;
        if (o.driver_id && window.fleetDrivers) {
            const drv = window.fleetDrivers.find(d => d.telegram_id === o.driver_id);
            if (drv) {
                driverDisplay = drv.driver_name || drv.first_name || driverDisplay;
                if (drv.car_brand) driverDisplay += ` • ${drv.car_brand}`;
            }
        }

        html += `
            <div class="order-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <h4>Заказ #${o.id}</h4>
                    <span style="font-size:11px; padding:2px 8px; border-radius:12px; border:1px solid ${statusColor}; color:${statusColor};">${prettyStatus}</span>
                </div>
                <p style="margin-bottom:3px;">👤 ${o.name} (${o.phone})</p>
                <p style="margin-bottom:3px;">📍 ${o.from_address} ➡️ ${o.to_address}</p>
                <p style="margin-bottom:3px;">🕒 ${o.date} ${o.time} • ${o.car_class || 'Эконом'}</p>
                ${o.passengers || o.luggage ? `<p style="margin-bottom:3px; color:var(--hint-color); font-size:12px;">👥 Пасс: ${o.passengers || '-'} | 🧳 Багаж: ${o.luggage || '-'}</p>` : ''}
                ${o.flight_number ? `<p style="margin-bottom:3px; color:var(--hint-color); font-size:12px;">✈️ Рейс: <b>${o.flight_number}</b></p>` : ''}
                ${o.meet_sign ? `<p style="margin-bottom:3px; color:var(--hint-color); font-size:12px;">🪧 Табличка: <b>${o.meet_sign}</b></p>` : ''}
                
                ${o.driver_id ? `<p style="margin-bottom:3px; color:var(--accent-color);">🚕 Водитель: ${driverDisplay}</p>` : ''}
                ${currentActiveRole === 'client' ? `<button class="repeat-order-btn" onclick="repeatOrder(${o.id}, '${o.from_address}', '${o.to_address}')">Повторить</button>` : ''}
                
                <!-- Driver Status Buttons -->
                ${currentActiveRole === 'driver' && o.status !== 'completed' && o.status !== 'cancelled' ? `
                    <div style="display:flex; gap:5px; margin-top:10px; flex-wrap:wrap;">
                        <a href="tel:${o.phone}" class="primary-btn alt-btn" style="text-decoration:none; padding:6px 10px; font-size:11px; border: 1px solid var(--accent-color); color:var(--accent-color);">📞 Звонок</a>
                        <a href="https://yandex.ru/maps/?rtext=~${encodeURIComponent(o.from_address + ' - ' + o.to_address)}&rtt=auto" target="_blank" class="primary-btn alt-btn" style="text-decoration:none; padding:6px 10px; font-size:11px; border: 1px solid #4CAF50; color:#4CAF50;">🧭 Навигатор</a>
                        ${o.status === 'assigned' ? `<button class="primary-btn pulse-btn" style="padding:6px 10px; font-size:11px;" onclick="updateOrderStatus(${o.id}, 'going')">Выехал</button>` : ''}
                        ${o.status === 'going' ? `<button class="primary-btn pulse-btn" style="padding:6px 10px; font-size:11px;" onclick="updateOrderStatus(${o.id}, 'waiting')">На месте (Ожидаю)</button>` : ''}
                        ${o.status === 'waiting' ? `<button class="primary-btn pulse-btn" style="padding:6px 10px; font-size:11px;" onclick="updateOrderStatus(${o.id}, 'in_progress')">Поехали</button>` : ''}
                        ${o.status === 'in_progress' ? `<button class="primary-btn pulse-btn" style="padding:6px 10px; font-size:11px;" onclick="updateOrderStatus(${o.id}, 'completed')">Завершить</button>` : ''}
                    </div>
                ` : ''}

                <!-- Dispatcher Call/Assign/Cancel Buttons -->
                ${currentActiveRole === 'dispatcher' ? <button class="primary-btn alt-btn" style="margin-top:10px; padding:6px 12px; font-size:12px; width:auto; border: 1px solid #FFC107; color:#FFC107;" onclick="openEditModal(, , '', '')">✏️ Ред.</button> : ''}
                ${currentActiveRole === 'dispatcher' ? <button class="primary-btn alt-btn" style="margin-top:10px; padding:6px 12px; font-size:12px; width:auto; border: 1px solid #FFC107; color:#FFC107;" onclick="openEditModal(, , '', '')">✏️ Ред.</button> : ''}
                ${currentActiveRole === 'dispatcher' && o.phone ? `<a href="tel:${o.phone}" class="primary-btn alt-btn" style="display:inline-block; text-decoration:none; margin-top:10px; padding:6px 12px; font-size:12px; width:auto; border: 1px solid var(--accent-color); color:var(--accent-color);">📞 Позв. клиенту</a>` : ''}
                ${currentActiveRole === 'dispatcher' && (o.status === 'new' || o.status === 'pending_client') ? `<button class="primary-btn pulse-btn" style="margin-top:10px; padding:8px 12px; font-size:12px; width:auto;" onclick="openAssignModal(${o.id})">Назначить водителя</button>` : ''}
                ${currentActiveRole === 'dispatcher' && o.status !== 'completed' && o.status !== 'cancelled' ? `<button class="primary-btn alt-btn" style="margin-top:10px; margin-left:5px; padding:8px 12px; font-size:12px; width:auto; border: 1px solid #ff5252; color:#ff5252;" onclick="cancelOrder(${o.id})">Отменить (✕)</button>` : ''}
            </div>
        `;
    });
    container.innerHTML = html;
}

// Add API Call logic for driver to update status
async function updateOrderStatus(orderId, newStatus) {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    try {
        const urlParams = window.location.search;
        const resp = await fetch(`https://swimsuit-sheath-viewless.ngrok-free.dev/api/order/${orderId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ caller_id: telegramId, status: newStatus })
        });
        const result = await resp.json();
        if (result.success) {
            initApp(); // Refresh orders visually
        } else {
            tg.showAlert('Ошибка обновления статуса');
        }
    } catch (e) {
        tg.showAlert('Ошибка сети');
    }
}

function repeatOrder(id, from, to) {
    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    const tabHome = document.querySelector('[data-tab="tab-home"]');
    if (tabHome) tabHome.click();
    if (clientPickup) clientPickup.value = from;
    if (clientDropoff) clientDropoff.value = to;
}

function setAddress(addr) {
    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    const pickup = document.getElementById('client-pickup');
    const dropoff = document.getElementById('client-dropoff');

    // Если поле "Откуда" пустое, ставим туда. Иначе если "Куда" пустое, ставим туда. Иначе заменяем "Куда".
    if (!pickup.value) {
        pickup.value = addr;
    } else if (!dropoff.value) {
        dropoff.value = addr;
    } else {
        dropoff.value = addr;
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
        < div class= "driver-list-item" onclick = "selectDriverForAssign(this, ${d.telegram_id})" id = "drv-item-${d.telegram_id}" >
        <div>
            <h4 style="font-size:13px; margin-bottom:2px;">${driverName}</h4>
            <p style="font-size:11px; color:var(--hint-color);">${carInfo}</p>
        </div>
                </div >
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

    clientOrderBtn.addEventListener('click', async () => {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');

        // Collect selected days if schedule
        let scheduleDays = [];
        if (clientFrequency.value === 'schedule' && clientRentType.value === 'transfer') {
            document.querySelectorAll('.day-check:checked').forEach(el => scheduleDays.push(el.value));
        }

        const orderBtnOrigText = clientOrderBtn.innerHTML;
        clientOrderBtn.innerHTML = 'Загрузка...';
        clientOrderBtn.disabled = true;

        try {
            const res = await fetch("https://swimsuit-sheath-viewless.ngrok-free.dev/api/order/create", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify({
                    telegram_id: telegramId,
                    name: firstName,
                    phone: '',
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
                    luggage: document.getElementById('client-luggage') ? document.getElementById('client-luggage').value : 0,
                    flight_number: document.getElementById('client-flight') ? document.getElementById('client-flight').value.trim() : '',
                    meet_sign: document.getElementById('client-meet-sign') ? document.getElementById('client-meet-sign').value.trim() : '',
                    carClass: clientSelectedClass,
                    comment: clientComment.value.trim(),
                    payment_method: window.currentPaymentMethod || 'Наличные'
                })
            });
            const data = await res.json();
            if (data.success) {
                tg.showAlert('Заказ успешно создан! Диспетчер скоро назначит водителя.');
                initApp(); // reload items
            } else {
                tg.showAlert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
            }
        } catch (e) {
            tg.showAlert('Ошибка сети, попробуйте позже.');
        } finally {
            clientOrderBtn.innerHTML = orderBtnOrigText;
            clientOrderBtn.disabled = false;
        }
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

            // Mock API Sync delay (3 seconds loading UI)
            setTimeout(async () => {

                try {
                    const res = await fetch("https://swimsuit-sheath-viewless.ngrok-free.dev/api/yandex/sync", {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                        body: JSON.stringify({ telegram_id: telegramId, phone: syncPhone.value.trim() })
                    });
                    const data = await res.json();

                    if (data.success) {
                        syncStep2.classList.add('hidden');
                        syncStep3.classList.remove('hidden');
                        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                        setTimeout(() => {
                            initApp(); // Switch to driver role view
                            driverRegistrationView.classList.add('hidden');
                        }, 2500);
                    } else {
                        syncStep2.classList.add('hidden');
                        syncStep1.classList.remove('hidden');
                        tg.showAlert('Ошибка: профиль Яндекса не найден.\n' + (data.error || ''));
                        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
                    }
                } catch (e) {
                    syncStep2.classList.add('hidden');
                    syncStep1.classList.remove('hidden');
                    tg.showAlert('Ошибка сети при синхронизации.');
                }

            }, 1000);

        } else {
            tg.showAlert('Пожалуйста, введите корректный номер телефона.');
        }
    });
}

// Kickstart
initApp();
setInterval(initApp, 5000); // Автообновление каждые 5 сек

// --- ADMIN LOGIC ---
function renderAdminDrivers() {
    const adminContainer = document.getElementById('admin-drivers-list');
    const dispContainer = document.getElementById('dispatcher-drivers-list');

    let html = '';
    const drivers = window.fleetDrivers || [];

    if (drivers.length === 0) {
        html = '<div class="empty-msg">Нет водителей в базе</div>';
        if (adminContainer) adminContainer.innerHTML = html;
        if (dispContainer) dispContainer.innerHTML = html;
        return;
    }

    drivers.forEach(d => {
        const isAllowed = d.status === "active";
        const toggleColor = isAllowed ? '#4CAF50' : 'var(--hint-color)';
        const btnText = isAllowed ? 'Отстранить' : 'Допустить';
        const statusText = isAllowed ? 'Допущен к трансферам' : 'Не допущен';
        const driverName = d.driver_name || d.first_name || 'Водитель';

        let carInfo = d.car_brand ? `${d.car_brand} • ${d.car_number || ''} ` : 'Нет авто';
        let yandexInfoHtml = '';
        if (d.yandex_id) {
            let wkStatus = d.yandex_status === 'working' ? '<span style="color:#4CAF50;">🟢 На линии</span>' : '<span style="color:var(--hint-color);">🔴 Офлайн</span>';
            yandexInfoHtml = `<div style="background: rgba(244,192,30,0.05); border:1px solid rgba(244,192,30,0.2); padding: 6px 10px; border-radius: 8px; margin-top: 5px;">
                                <p style="font-size:11px; margin-bottom:2px; color:var(--accent-color);"><b>Yandex.PRO:</b> ${wkStatus}</p>
                                <p style="font-size:11px; color:var(--hint-color);"><span style="color:var(--text-color);">🚕</span> ${d.yandex_car || 'Нет авто'}</p>
                              </div>`;
        }

        html += `
            <div class="glass-card" style="margin-bottom:10px; padding:15px; border-left: 4px solid ${toggleColor};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h4 style="font-size:15px; margin-bottom:5px;">${driverName}</h4>
                        <p style="font-size:12px; color:var(--hint-color); margin-bottom:2px;">${carInfo}</p>
                        <p style="font-size:11px; color:${toggleColor}; font-weight:600;">${statusText}</p>
                        ${yandexInfoHtml}
                    </div>
                    <div style="display:flex; flex-direction:column; gap:5px; align-items:flex-end;">
                        <button class="primary-btn alt-btn" style="width:auto; padding:6px 12px; font-size:11px;" onclick="toggleDriverAccess(${d.telegram_id})">${btnText}</button>
                        <button class="primary-btn" style="width:auto; padding:6px 12px; font-size:11px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-color);" onclick="openManageDriverModal(${d.telegram_id})">💰 Финансы</button>
                    </div>
                </div>
            </div>
            `;
    });
    if (adminContainer) adminContainer.innerHTML = html;
    if (dispContainer) dispContainer.innerHTML = html;
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

// --- MANAGE DRIVER BALANCE (Admin/Dispatcher) ---
let activeManageDriverId = null;

async function openManageDriverModal(driverId) {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    activeManageDriverId = driverId;

    // Find driver in local state
    const drv = (window.fleetDrivers || []).find(d => d.telegram_id === driverId);
    const driverName = drv ? (drv.driver_name || drv.first_name || 'Водитель') : 'Водитель';

    document.getElementById('manage-driver-name').textContent = '💰 ' + driverName;
    document.getElementById('manage-amount').value = '';
    document.getElementById('manage-desc').value = '';

    // Show modal first with loading state
    document.getElementById('manage-driver-balance').textContent = '...';
    document.getElementById('manage-driver-modal').classList.remove('hidden');

    // Fetch current balance from API
    try {
        const BASE = 'https://swimsuit-sheath-viewless.ngrok-free.dev';
        const resp = await fetch(`${BASE} /api/driver / ${driverId}/balance`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (resp.ok) {
            const data = await resp.json();
            const bal = data.balance ?? 0;
            const balEl = document.getElementById('manage-driver-balance');
            balEl.textContent = bal.toLocaleString('ru-RU') + ' ₸';
            balEl.style.color = bal < 0 ? '#ff5252' : '#4CAF50';
        }
    } catch (e) {
        document.getElementById('manage-driver-balance').textContent = 'Ошибка загрузки';
    }
}

function closeManageDriverModal() {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    document.getElementById('manage-driver-modal').classList.add('hidden');
    activeManageDriverId = null;
}

async function submitDriverBalance() {
    const amount = parseInt(document.getElementById('manage-amount').value);
    const desc = document.getElementById('manage-desc').value.trim();

    if (!amount || amount === 0) {
        tg.showAlert('Введите сумму (положительную для пополнения, отрицательную для списания)');
        return;
    }
    if (!desc) {
        tg.showAlert('Укажите причину изменения баланса');
        return;
    }
    if (!activeManageDriverId) return;

    const confirmMsg = amount > 0
        ? `Зачислить +${amount} ₸ водителю?\nПричина: ${desc}`
        : `Списать ${amount} ₸ с водителя?\nПричина: ${desc}`;

    tg.showConfirm(confirmMsg, async (confirmed) => {
        if (!confirmed) return;
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');

        const btn = document.getElementById('manage-driver-btn');
        btn.disabled = true;
        btn.textContent = 'Отправка...';

        try {
            const BASE = 'https://swimsuit-sheath-viewless.ngrok-free.dev';
            const resp = await fetch(`${BASE}/api/driver/${activeManageDriverId}/balance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    caller_id: telegramId,
                    amount: amount,
                    description: desc
                })
            });
            const result = await resp.json();
            if (result.success) {
                tg.showAlert(`✅ Готово! Новый баланс: ${result.new_balance.toLocaleString('ru-RU')} ₸`);
                // Update local driver balance display
                const drv = (window.fleetDrivers || []).find(d => d.telegram_id === activeManageDriverId);
                if (drv) drv.balance = result.new_balance;
                closeManageDriverModal();
            } else {
                tg.showAlert('Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (e) {
            tg.showAlert('Ошибка сети. Проверьте подключение.');
        }

        btn.disabled = false;
        btn.textContent = 'Подтвердить изменение';
    });
}

window.currentPaymentMethod = 'Kaspi Gold (*4512)';
function openPaymentModal() {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    document.getElementById('payment-modal').classList.remove('hidden');
}

function closePaymentModal() {
    document.getElementById('payment-modal').classList.add('hidden');
}

function selectPayment(el, name, icon) {
    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    window.currentPaymentMethod = name;
    document.getElementById('selected-payment-text').textContent = name;
    document.getElementById('selected-payment-icon').textContent = icon;

    const pv = document.getElementById('profile-payment-value');
    if (pv) pv.textContent = name;

    // Update UI
    document.querySelectorAll('.payment-option').forEach(item => {
        item.style.border = '1px solid rgba(255,255,255,0.05)';
        const check = item.querySelector('span:last-child');
        if (check && check.textContent === '✅') check.remove();
    });
    el.style.border = '1px solid var(--accent-color)';
    el.innerHTML += '<span style="color:var(--accent-color); font-size:18px;">✅</span>';

    closePaymentModal();
}

function simulateAddCard() {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    tg.showConfirm('Тестовая привязка. Спишется 10 ₸ для проверки.', function (confirmed) {
        if (confirmed) {
            tg.showAlert('Успешно! Новая карта Visa (*9910) привязана.');
            // Update to new card mentally
            window.currentPaymentMethod = 'Visa (*9910)';
            document.getElementById('selected-payment-text').textContent = 'Visa (*9910)';
            document.getElementById('selected-payment-icon').textContent = '💳';
            const pv = document.getElementById('profile-payment-value');
            if (pv) pv.textContent = 'Visa *9910';
            closePaymentModal();
        }
    });
}

function openWalletModal() {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

    // Update balance
    if (window.driverData) {
        const bal = parseInt(window.driverData.balance) || 0;
        const yandexBal = parseInt(window.driverData.yandex_balance) || 0;
        const bonusBal = parseInt(window.driverData.bonus_balance) || 0;

        const mMax = document.getElementById('modal-max-balance');
        if (mMax) mMax.textContent = bal.toLocaleString('ru-RU') + ' ₸';

        const mYnd = document.getElementById('modal-yandex-balance');
        if (mYnd) mYnd.textContent = yandexBal.toLocaleString('ru-RU') + ' ₸';

        const mBon = document.getElementById('modal-bonus-balance');
        if (mBon) mBon.textContent = bonusBal.toLocaleString('ru-RU') + ' ⭐️';
    }

    // Render transactions
    renderTransactions(window.driverTransactions || []);

    document.getElementById('wallet-modal').classList.remove('hidden');
}

function closeWalletModal() {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    document.getElementById('wallet-modal').classList.add('hidden');
}

function requestWithdraw() {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    tg.showConfirm('Запросить вывод всех доступных средств на Kaspi Gold?', (confirmed) => {
        if (confirmed) {
            tg.showAlert('Запрос на вывод отправлен диспетчеру. Средства поступят в течение дня.');
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            // This is a stub for now, in a real app would call API
        }
    });
}

function renderTransactions(txs) {
    const container = document.getElementById('wallet-history-container');
    if (!container) return;

    if (txs.length === 0) {
        container.innerHTML = '<div style="padding:15px; text-align:center; color:var(--hint-color); font-size:13px;">Нет операций</div>';
        return;
    }

    let html = '';
    txs.forEach(tx => {
        // Assume tx has: id, type, amount, description, created_at
        const isPositive = tx.amount > 0;
        const colorClass = isPositive ? '#4CAF50' : '#ff5252';
        const sign = isPositive ? '+' : '';
        const symbol = isPositive ? '+' : '-';
        const bg = isPositive ? 'rgba(76,175,80,0.1)' : 'rgba(255,82,82,0.1)';

        let dateObj = new Date(tx.created_at + 'Z');
        let dateStr = dateObj.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        if (dateStr === 'Invalid Date') {
            dateStr = tx.created_at; // Fallback
        }

        html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; gap:10px; align-items:center;">
                <div style="width:30px; height:30px; border-radius:8px; background:${bg}; color:${colorClass}; display:flex; align-items:center; justify-content:center; font-size:16px;">
                    ${symbol}
                </div>
                <div>
                    <p style="font-size:13px; font-weight:600;">${tx.description || tx.type || 'Операция'}</p>
                    <p style="font-size:11px; color:var(--hint-color);">${dateStr}</p>
                </div>
            </div>
            <p style="font-size:14px; font-weight:600; color:${colorClass};">${sign}${tx.amount} ₸</p>
        </div>
        `;
    });

    container.innerHTML = html;
}

let currentEditOrderId = null;
function openEditModal(orderId, price, date, time) {
    currentEditOrderId = orderId;
    document.getElementById('edit-order-price').value = price || '';
    document.getElementById('edit-order-date').value = date || '';
    document.getElementById('edit-order-time').value = time || '';
    document.getElementById('edit-order-modal').classList.remove('hidden');
}

document.getElementById('confirm-edit-btn').addEventListener('click', async () => {
    const price = document.getElementById('edit-order-price').value;
    const date = document.getElementById('edit-order-date').value;
    const time = document.getElementById('edit-order-time').value;
    await fetch('/api/order/' + currentEditOrderId, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caller_id: window.tgData.user.id, price: price ? parseInt(price) : null, date: date || null, time: time || null })
    });
    document.getElementById('edit-order-modal').classList.add('hidden');
    loadOrders();
});

let currentChatOrderId = null;
function openChatModal(orderId) {
    currentChatOrderId = orderId;
    document.getElementById('chat-message-input').value = '';
    document.getElementById('chat-driver-modal').classList.remove('hidden');
}
document.getElementById('send-chat-btn')?.addEventListener('click', async () => {
    const msg = document.getElementById('chat-message-input').value;
    if (!msg) return;
    try {
        await fetch('/api/order/' + currentChatOrderId + '/message_driver', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ caller_id: window.tgData.user.id, message: msg })
        });
        tg.showAlert('Сообщение отправлено водителю!');
    } catch(e) {}
    document.getElementById('chat-driver-modal').classList.add('hidden');
});

async function loadAdminStats() {
    try {
        const res = await fetch('/api/admin/stats?caller_id=' + window.tgData.user.id);
        const data = await res.json();
        document.getElementById('dash-rev').textContent = (data.revenue || 0).toLocaleString('ru-RU') + ' ₸';
        document.getElementById('dash-comp').textContent = data.total_completed;
        document.getElementById('dash-total-ord').textContent = data.total_orders;
        document.getElementById('dash-drv-on').textContent = data.drivers_online + ' / ' + data.total_drivers;
    } catch(e) {}
}
