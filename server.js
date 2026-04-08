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
        subscriptions.forEach(sub => {
            webpush.sendNotification(sub, payload).catch(err =>
                console.error('Push error:', err)
            );
        });
    });

    socket.on('disconnect', () => {
        console.log('Клиент отключён:', socket.id);
    });
});

// Эндпоинты для управления push-подписками
app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    subscriptions.push(subscription);
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

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
