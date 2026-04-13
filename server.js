const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const vapidKeys = {
    publicKey: 'BJ-35-_hA1zmblHdCIlFyyb5J_CzG_AchRraiktI9XREwCqtDfBTSVpxOk-dVS_Rewzg3-nySMN1XCgSOUlz6No',
    privateKey: '9_bS0fe3gBJRs-55XW-uzDVpTGL58Km2C2WAiPUPeoU'
};

webpush.setVapidDetails(
    'mailto:notes@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './')));

// Хранилище подписок
let subscriptions = [];
// Хранилище активных напоминаний: ключ - id заметки
const reminders = new Map();

function sendPushToAll(payload) {
    subscriptions.forEach(sub => {
        webpush.sendNotification(sub, payload).catch(err => {
            console.error('Push error:', err.statusCode || '', err.message || err);

            // Удаляем подписки, которые больше недействительны.
            if (err.statusCode === 404 || err.statusCode === 410) {
                subscriptions = subscriptions.filter(item => item.endpoint !== sub.endpoint);
            }
        });
    });
}

const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    console.log('Клиент подключён:', socket.id);

    // Обработка события 'newTask' от клиента
    socket.on('newTask', (task) => {
        console.log('Получено событие newTask:', task);
        
        // Рассылаем событие всем подключённым клиентам, включая отправителя
        io.emit('taskAdded', task);

        // Формируем payload для push-уведомления
        const payload = JSON.stringify({
            title: 'Новая заметка',
            body: task.text
        });

        // Отправляем уведомление всем подписанным клиентам
        sendPushToAll(payload);
    });

    socket.on('newReminder', (reminder) => {
        const { id, text, reminderTime } = reminder;
        const delay = reminderTime - Date.now();

        if (delay <= 0) {
            return;
        }

        const timeoutId = setTimeout(() => {
            const payload = JSON.stringify({
                title: '!!! Напоминание',
                body: text,
                reminderId: id
            });

            sendPushToAll(payload);

            reminders.delete(id);
        }, delay);

        reminders.set(id, { timeoutId, text, reminderTime });
    });

    socket.on('disconnect', () => {
        console.log('Клиент отключён:', socket.id);
    });
});

// Эндпоинты для управления push-подписками
app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ message: 'Некорректная подписка' });
    }

    const exists = subscriptions.some(sub => sub.endpoint === subscription.endpoint);
    if (!exists) {
        subscriptions.push(subscription);
    }

    console.log('Новая подписка сохранена. Всего подписок:', subscriptions.length);
    res.status(201).json({ message: 'Подписка сохранена' });
});

app.post('/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    const before = subscriptions.length;
    subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
    console.log('Подписка удалена. Было:', before, 'Стало:', subscriptions.length);
    res.status(200).json({ message: 'Подписка удалена' });
});

app.post('/snooze', (req, res) => {
    const reminderId = parseInt(req.query.reminderId, 10);

    if (!reminderId || !reminders.has(reminderId)) {
        return res.status(404).json({ error: 'Reminder not found' });
    }

    const reminder = reminders.get(reminderId);
    clearTimeout(reminder.timeoutId);

    const newDelay = 5 * 60 * 1000;
    const newTimeoutId = setTimeout(() => {
        const payload = JSON.stringify({
            title: 'Напоминание отложено',
            body: reminder.text,
            reminderId: reminderId
        });

        sendPushToAll(payload);

        reminders.delete(reminderId);
    }, newDelay);

    reminders.set(reminderId, {
        timeoutId: newTimeoutId,
        text: reminder.text,
        reminderTime: Date.now() + newDelay
    });

    return res.status(200).json({ message: 'Reminder snoozed for 5 minutes' });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
