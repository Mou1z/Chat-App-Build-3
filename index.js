const path = require('path');

const http = require('http');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

const db = require('./database');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');

const multer = require('multer');
//const upload = multer({ dest: 'uploads/' });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public/uploads'));
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + Date.now() + ext);
    }
});

const upload = multer({ storage: storage });

const app = express();
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server);

const PORT = 3000;

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: '3x@mp13K3y',
    resave: false,
    saveUninitialized: true
}));

app.get('/', (request, response) => {
    response.render(__dirname + '/views/main.ejs', { option: 1 });
});

app.get('/history', (request, response) => {
    let query = `SELECT * FROM messages WHERE chatroom_id = ?`;
    const params = [];

    if (!request.query.id) {
        return response.status(400).send('Chatroom not found');
    }

    params.push(request.query.id);

    if (request.query.sender) {
        query += ` AND sender = ?`;
        params.push(request.query.sender);
    }

    db.all(query, params, (error, messages) => {
        if (error) {
            console.error(error.message);
            return response.status(500).send('Internal Server Error');
        }

        response.json(messages);
    });
});

app.post('/send-message', (req, res) => {
    const { token, chatroomId, content } = req.body;

    if (!token || !chatroomId || !content) {
        return res.status(400).send('Missing required parameter(s)');
    }

    const userQuery = `SELECT username, profile_picture FROM users WHERE token = ?`;
    db.get(userQuery, [token], (err, user) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        if (!user) {
            return res.status(400).send('Invalid user token');
        }

        const messageQuery = `INSERT INTO messages (sender, content, chatroom_id, sender_profile_picture) VALUES (?, ?, ?, ?)`;
        db.run(messageQuery, [user.username, content, chatroomId, user.profile_picture], function(err) {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error sending message');
            }

            io.to(chatroomId).emit('chat message', {
                sender: user.username,
                content: content,
                senderProfilePicture: user.profile_picture
            });

            res.status(200).send('Message sent');
        });
    });
});

app.post('/register', async (request, response) => {
    const { username, email, password } = request.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(16).toString('hex');

    const query = `INSERT INTO users (username, email, password, profile_picture, token) VALUES (?, ?, ?, '/uploads/default.jpg', ?)`;

    db.run(query, [username, email, hashedPassword, token], function(err) {
        if (err) {
            console.error(err.message);
            return response.status(400).send('User already exists');
        }
        response.redirect('/');
    });
});

app.post('/login', (request, response) => {
    const { username, password } = request.body;

    // For an SQL injection example later
    const query = `SELECT * FROM users WHERE username = '${username}'`;
    db.get(query, async (error, user) => {
        if (error) {
            console.error(error.message);
            return response.status(500).send('Internal Server Error');
        }
        if (user && await bcrypt.compare(password, user.password)) {
            request.session.user = user;
            return response.redirect('/chatrooms');
        }
        response.status(400).send('Invalid username or password');
    });
});

function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    } else {
        return res.redirect('/');
    }
}

app.post('/create-chatroom', requireAuth, async (request, response) => {
    const { name, password } = request.body;
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const query = `INSERT INTO chatrooms (name, password, creator_id) VALUES (?, ?, ?)`;
    db.run(query, [name, hashedPassword, request.session.user.id], function(err) {
        if (err) {
            console.error(err.message);
            return response.status(500).send('Error creating chatroom');
        }
        response.redirect('/chatrooms');
    });
});

// List chatrooms route
app.get('/chatrooms', requireAuth, (request, response) => {
    const query = `SELECT * FROM chatrooms`;

    db.all(query, [], (error, chatrooms) => {
        if (error) {
            console.error(error.message);
            return response.status(500).send('Internal Server Error');
        }

        response.render(__dirname + '/views/chatrooms.ejs', { chatrooms });
    });
});

// Join chatroom route
app.post('/join-chatroom', requireAuth, async (request, response) => {
    const { chatroomId, password } = request.body;

    const query = `SELECT * FROM chatrooms WHERE id = ?`;
    db.get(query, [chatroomId], async (error, chatroom) => {
        if (error) {
            console.error(error.message);
            return response.status(500).send('Internal Server Error');
        }

        if (chatroom.password && !(await bcrypt.compare(password, chatroom.password))) {
            return response.status(400).send('Invalid password');
        }

        const insertQuery = `INSERT INTO chatroom_users (user_id, chatroom_id) VALUES (?, ?)`;
        db.run(insertQuery, [request.session.user.id, chatroomId], function(err) {
            if (err) {
                console.error(err.message);
                return response.status(500).send('Error joining chatroom');
            }
            response.redirect(`/chatroom/${chatroomId}`);
        });
    });
});

app.get('/chatroom/:id', requireAuth, (request, response) => {
    const { id } = request.params;

    const messagesQuery = `
        SELECT messages.* 
        FROM messages 
        JOIN users ON messages.sender = users.username 
        WHERE chatroom_id = ?`;

    db.all(messagesQuery, [id], (error, messages) => {
        if (error) {
            console.error(error.message);
            return response.status(500).send('Internal Server Error');
        }

        response.render(__dirname + '/views/chat.ejs', { 
            ...request.session.user,
            chatroomId: id,
            chatHistory: messages
        });
    });
});

app.get('/profile', requireAuth, (req, res) => {
    res.render(__dirname + '/views/profile.ejs', { user: req.session.user });
});

app.post('/profile', requireAuth, upload.single('profile_picture'), async (req, res) => {
    const { username, email, password } = req.body;
    let profilePicture = req.file ? path.basename(req.file.path) : req.session.user.profile_picture;

    profilePicture = path.join('uploads', profilePicture);

    if (profilePicture && !profilePicture.startsWith('/')) {
        profilePicture = '/' + profilePicture.replace(/\\/g, '/');
    }

    let query = `UPDATE users SET username = ?, email = ?, profile_picture = ? WHERE id = ?`;
    const params = [username, email, profilePicture, req.session.user.id];

    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        query = `UPDATE users SET username = ?, email = ?, password = ?, profile_picture = ? WHERE id = ?`;
        params.splice(2, 0, hashedPassword);
    }

    db.run(query, params, function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        req.session.user.username = username;
        req.session.user.email = email;
        req.session.user.profile_picture = profilePicture;
        res.redirect('/profile');
    });
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    socket.on('chat message', (msg) => {
        const query = `INSERT INTO messages (sender, content, chatroom_id, sender_profile_picture) VALUES (?, ?, ?, ?)`;

        db.run(query, [msg.sender, msg.content, msg.chatroomId, msg.senderProfilePicture], function(err) {
            if (err) {
                console.error(err.message);
            }

            io.to(msg.chatroomId).emit('chat message', {
                sender: msg.sender,
                content: msg.content,
                senderProfilePicture: msg.senderProfilePicture
            });
        });
    });

    socket.on('join room', (chatroomId) => {
        socket.join(chatroomId);
        console.log(`user joined room ${chatroomId}`);
    });
});

server.listen(PORT, () => {
    console.log(`>> Server started on port ${PORT}`);
});