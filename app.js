// Socket.IO подключение
const socket = io('http://localhost:3001');

// DOM элементы
const contentDiv = document.getElementById('app-content');
const homeBtn = document.getElementById('home-btn');
const aboutBtn = document.getElementById('about-btn');

// Функция для преобразования VAPID ключа
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Функция подписки на push
async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array('BJ-35-_hA1zmblHdCIlFyyb5J_CzG_AchRraiktI9XREwCqtDfBTSVpxOk-dVS_Rewzg3-nySMN1XCgSOUlz6No')
        });

        await fetch('http://localhost:3001/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });
        
        console.log('Подписка на push отправлена');
    } catch (err) {
        console.error('Ошибка подписки на push:', err);
    }
}

// Функция отписки от push
async function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
            await fetch('http://localhost:3001/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: subscription.endpoint })
            });
            await subscription.unsubscribe();
            console.log('Отписка выполнена');
        }
    } catch (err) {
        console.error('Ошибка отписки:', err);
    }
}

// Обработчик события taskAdded от сервера
socket.on('taskAdded', (task) => {
    console.log('Задача от другого клиента:', task);
    
    // Показываем всплывающее уведомление
    const notification = document.createElement('div');
    notification.textContent = `Новая заметка: ${task.text}`;
    notification.style.cssText = `
        position: fixed; top: 10px; right: 10px;
        background: #4285f4; color: white; padding: 1rem;
        border-radius: 5px; z-index: 1000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
});

function setActiveButton(activeId) {
    [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
    document.getElementById(activeId).classList.add('active');
}

async function loadContent(page) {
    try {
        const response = await fetch(`/content/${page}.html`);
        const html = await response.text();
        contentDiv.innerHTML = html;
        
        if (page === 'home') {
            initNotes();
        }
    } catch (err) {
        contentDiv.innerHTML = `<p class="is-center text-error">Ошибка загрузки страницы.</p>`;
        console.error(err);
    }
}

homeBtn.addEventListener('click', () => {
    setActiveButton('home-btn');
    loadContent('home');
});

aboutBtn.addEventListener('click', () => {
    setActiveButton('about-btn');
    loadContent('about');
});

// Загружаем главную страницу при старте
loadContent('home');

// Функционал заметок (localStorage)
function initNotes() {
    const form = document.getElementById('note-form');
    const input = document.getElementById('note-input');
    const list = document.getElementById('notes-list');

    function loadNotes() {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        list.innerHTML = notes.map((note, i) => {
            const isDone = note.done ? 'done' : '';
            return `
                <li class="card ${isDone}" style="margin-bottom: 0.5rem; padding: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <span style="${note.done ? 'text-decoration: line-through; color: #999;' : ''}">${note.text}</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="toggleNote(${i})" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">${note.done ? 'Отменить' : 'Готово'}</button>
                        <button onclick="deleteNote(${i})" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Удалить</button>
                    </div>
                </li>
            `;
        }).join('');
    }

    function addNote(text) {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        notes.push({ text, done: false });
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
        
        // Отправляем событие на сервер через WebSocket
        socket.emit('newTask', { text, timestamp: Date.now() });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) {
            addNote(text);
            input.value = '';
        }
    });

    loadNotes();
}

// Глобальные функции для удаления и выполнения заметок
function toggleNote(index) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes[index].done = !notes[index].done;
    localStorage.setItem('notes', JSON.stringify(notes));
    // Перезагружаем список
    const list = document.getElementById('notes-list');
    const notes2 = JSON.parse(localStorage.getItem('notes') || '[]');
    list.innerHTML = notes2.map((note, i) => {
        const isDone = note.done ? 'done' : '';
        return `
            <li class="card ${isDone}" style="margin-bottom: 0.5rem; padding: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                <span style="${note.done ? 'text-decoration: line-through; color: #999;' : ''}">${note.text}</span>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="toggleNote(${i})" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">${note.done ? 'Отменить' : 'Готово'}</button>
                    <button onclick="deleteNote(${i})" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Удалить</button>
                </div>
            </li>
        `;
    }).join('');
}

function deleteNote(index) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.splice(index, 1);
    localStorage.setItem('notes', JSON.stringify(notes));
    // Перезагружаем список
    const list = document.getElementById('notes-list');
    const notes2 = JSON.parse(localStorage.getItem('notes') || '[]');
    list.innerHTML = notes2.map((note, i) => {
        const isDone = note.done ? 'done' : '';
        return `
            <li class="card ${isDone}" style="margin-bottom: 0.5rem; padding: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                <span style="${note.done ? 'text-decoration: line-through; color: #999;' : ''}">${note.text}</span>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="toggleNote(${i})" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">${note.done ? 'Отменить' : 'Готово'}</button>
                    <button onclick="deleteNote(${i})" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Удалить</button>
                </div>
            </li>
        `;
    }).join('');
}

// Регистрация Service Worker и настройка push-уведомлений
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            console.log('🔧 Начинаем регистрацию Service Worker...');
            const reg = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ SW registered successfully!');
            console.log('Scope:', reg.scope);
            
            // Настройка кнопок push-уведомлений
            const enableBtn = document.getElementById('enable-push');
            const disableBtn = document.getElementById('disable-push');
            
            if (enableBtn && disableBtn) {
                // Проверяем текущую подписку
                const subscription = await reg.pushManager.getSubscription();
                if (subscription) {
                    enableBtn.style.display = 'none';
                    disableBtn.style.display = 'inline-block';
                }
                
                // Обработчик включения уведомлений
                enableBtn.addEventListener('click', async () => {
                    if (Notification.permission === 'denied') {
                        alert('Уведомления запрещены. Разрешите их в настройках браузера.');
                        return;
                    }
                    
                    if (Notification.permission === 'default') {
                        const permission = await Notification.requestPermission();
                        if (permission !== 'granted') {
                            alert('Необходимо разрешить уведомления.');
                            return;
                        }
                    }
                    
                    await subscribeToPush();
                    enableBtn.style.display = 'none';
                    disableBtn.style.display = 'inline-block';
                });
                
                // Обработчик отключения уведомлений
                disableBtn.addEventListener('click', async () => {
                    await unsubscribeFromPush();
                    disableBtn.style.display = 'none';
                    enableBtn.style.display = 'inline-block';
                });
            }
        } catch (err) {
            console.error('❌ SW registration failed:', err);
        }
    });
} else {
    console.warn('⚠️ Service Workers не поддерживаются в этом браузере');
}

