// DOM элементы
const form = document.getElementById('task-form');
const input = document.getElementById('task-input');
const list = document.getElementById('tasks-list');
const offlineBanner = document.getElementById('offline-banner');

// Офлайн-баннер
function updateOnlineStatus() {
    offlineBanner.classList.toggle('visible', !navigator.onLine);
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// Загрузка задач из localStorage
function loadTasks() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    list.innerHTML = tasks.map((task, i) => `
        <li class="${task.done ? 'done' : ''}" data-index="${i}">
            <span>${task.text}</span>
            <div class="task-actions">
                <button onclick="toggleTask(${i})">${task.done ? 'Отменить' : 'Готово'}</button>
                <button onclick="deleteTask(${i})">Удалить</button>
            </div>
        </li>
    `).join('');
}

// Добавление задачи
function addTask(text) {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    tasks.push({ text, done: false });
    localStorage.setItem('tasks', JSON.stringify(tasks));
    loadTasks();
}

// Переключение статуса задачи
function toggleTask(index) {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    tasks[index].done = !tasks[index].done;
    localStorage.setItem('tasks', JSON.stringify(tasks));
    loadTasks();
}

// Удаление задачи
function deleteTask(index) {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    tasks.splice(index, 1);
    localStorage.setItem('tasks', JSON.stringify(tasks));
    loadTasks();
}

// Обработка формы
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
        addTask(text);
        input.value = '';
    }
});

// Первоначальная загрузка
loadTasks();

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('ServiceWorker зарегистрирован:', registration.scope);
        } catch (err) {
            console.error('Ошибка регистрации ServiceWorker:', err);
        }
    });
}
