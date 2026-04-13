// Socket.IO подключение
console.log('📡 Подключаюсь к Socket.IO...');
const socket = io('http://localhost:3001');

socket.on('connect', () => {
    console.log('✅ Socket.IO подключен! ID:', socket.id);
});

socket.on('disconnect', () => {
    console.log('❌ Socket.IO отключен');
});

socket.on('error', (err) => {
    console.error('❌ Socket.IO ошибка:', err);
});

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
async function syncSubscriptionWithServer(subscription) {
    await fetch('http://localhost:3001/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
    });
}

async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array('BJ-35-_hA1zmblHdCIlFyyb5J_CzG_AchRraiktI9XREwCqtDfBTSVpxOk-dVS_Rewzg3-nySMN1XCgSOUlz6No')
            });
        }

        await syncSubscriptionWithServer(subscription);
        
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
function getNotesFromStorage() {
    const rawNotes = JSON.parse(localStorage.getItem('notes') || '[]');
    let changed = false;

    const normalized = rawNotes.map((note, index) => {
        if (typeof note === 'string') {
            changed = true;
            return { id: Date.now() + index, text: note, done: false, reminder: null };
        }

        const normalizedNote = {
            id: note.id || Date.now() + index,
            text: note.text || '',
            done: Boolean(note.done),
            reminder: note.reminder || null
        };

        if (!note.id || !Object.prototype.hasOwnProperty.call(note, 'reminder')) {
            changed = true;
        }

        return normalizedNote;
    });

    if (changed) {
        localStorage.setItem('notes', JSON.stringify(normalized));
    }

    return normalized;
}

function renderNotesList() {
    const list = document.getElementById('notes-list');
    if (!list) return;

    const notes = getNotesFromStorage();
    list.innerHTML = notes.map((note) => {
        let reminderInfo = '';
        if (note.reminder) {
            const date = new Date(note.reminder);
            reminderInfo = `<br><small>!!! Напоминание: ${date.toLocaleString()}</small>`;
        }

        return `
            <li class="card" style="margin-bottom: 0.5rem; padding: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                <span style="${note.done ? 'text-decoration: line-through; color: #999;' : ''}">${note.text}${reminderInfo}</span>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="toggleNote(${note.id})" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">${note.done ? 'Отменить' : 'Готово'}</button>
                    <button onclick="deleteNote(${note.id})" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Удалить</button>
                </div>
            </li>
        `;
    }).join('');
}

function initNotes() {
    const form = document.getElementById('note-form');
    const input = document.getElementById('note-input');
    const reminderForm = document.getElementById('reminder-form');
    const reminderText = document.getElementById('reminder-text');
    const reminderTime = document.getElementById('reminder-time');

    function addNote(text, reminderTimestamp = null) {
        const notes = getNotesFromStorage();
        const newNote = {
            id: Date.now(),
            text,
            done: false,
            reminder: reminderTimestamp
        };

        notes.push(newNote);
        localStorage.setItem('notes', JSON.stringify(notes));
        renderNotesList();

        if (reminderTimestamp) {
            socket.emit('newReminder', {
                id: newNote.id,
                text,
                reminderTime: reminderTimestamp
            });
        } else {
            socket.emit('newTask', { text, timestamp: Date.now() });
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) {
            addNote(text);
            input.value = '';
        }
    });

    if (reminderForm) {
        reminderForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const text = reminderText.value.trim();
            const datetime = reminderTime.value;

            if (text && datetime) {
                const timestamp = new Date(datetime).getTime();
                if (timestamp > Date.now()) {
                    addNote(text, timestamp);
                    reminderText.value = '';
                    reminderTime.value = '';
                } else {
                    alert('Дата напоминания должна быть в будущем');
                }
            }
        });
    }

    renderNotesList();
}

// Глобальные функции для удаления и выполнения заметок
function toggleNote(noteId) {
    const notes = getNotesFromStorage();
    const index = notes.findIndex(note => note.id === noteId);
    if (index === -1) return;

    notes[index].done = !notes[index].done;
    localStorage.setItem('notes', JSON.stringify(notes));
    renderNotesList();
}

function deleteNote(noteId) {
    const notes = getNotesFromStorage();
    const filtered = notes.filter(note => note.id !== noteId);
    if (filtered.length === notes.length) return;

    localStorage.setItem('notes', JSON.stringify(filtered));
    renderNotesList();
}

window.toggleNote = toggleNote;
window.deleteNote = deleteNote;

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
                    // После перезапуска сервера синхронизируем подписку повторно.
                    await syncSubscriptionWithServer(subscription);
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

