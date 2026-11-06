const session = require('express-session');
const { MongoStore } = require('connect-mongo');

function createSessionMiddleware() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Thiếu MONGODB_URI để lưu session.');
  }
  if (!process.env.SESSION_SECRET) {
    throw new Error('Thiếu SESSION_SECRET. Hãy cấu hình biến này trong .env.');
  }

  return session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions'
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  });
}

module.exports = createSessionMiddleware;