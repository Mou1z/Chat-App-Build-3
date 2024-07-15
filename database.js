const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chat-app.db');

db.serialize(() => {

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(36) UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        profile_picture TEXT,
        token TEXT UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        chatroom_id INTEGER NOT NULL,
        sender_profile_picture TEXT, 
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chatroom_id) REFERENCES chatrooms(id)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS chatrooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        password TEXT,
        creator_id INTEGER NOT NULL,
        FOREIGN KEY (creator_id) REFERENCES users(id)
    )`)

    db.run(`CREATE TABLE IF NOT EXISTS chatroom_users (
        user_id INTEGER,
        chatroom_id INTEGER,    
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (chatroom_id) REFERENCES chatrooms(id)
    );`)
});

module.exports = db;