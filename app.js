const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const { PrismaClient } = require("./generated/prisma");
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
// TODO: REMOVE AFTER MAKING SURE PRISMA WAY WORKS
// const pg = require("pg");

const indexRouter = require('./routers/indexRouter');

require("dotenv").config();

const prisma = new PrismaClient();      // Prisma uses its own pool internally
const PORT = process.env.PORT || 8080;
const app = express();

//setup for login sessions
app.use(
  session({
    cookie: {
     maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    },
    secret: process.env.SECRET,
    resave: true,
    saveUninitialized: true,
    store: new PrismaSessionStore(
      new PrismaClient(),
      {
        checkPeriod: 2 * 60 * 1000,  //ms
        dbRecordIdIsSessionId: true,
        dbRecordIdFunction: undefined,
      }
    )
  }),
);

//Set-up url request body parsing
app.use(express.urlencoded({ extended: false }));
//Set-up EJS
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
//Set-up Public files
const assetsPath = path.join(__dirname, "public");
app.use(express.static(assetsPath));
//Set-up for classic session
app.use(passport.session());

//Set-up passport strategy
passport.use(
  new LocalStrategy(async (username, password, done) => {
    const user = await prisma.user.findUnique({
      where: {
        username: username
      }
    })
    if (!user) {
      return done(null, false, { message: "Incorrect username" });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      // passwords do not match!
      return done(null, false, { message: "Incorrect password" });
    }
    return done(null, user);
  }),
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await prisma.user.findUnique({
    where: {
      id: id
    }
  })
  done(null, user);
});

app.use('/', indexRouter);

app.get("/*splat", async (req, res) => {
  res.send("You cannot be here :( .");
});

//Error middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('errPage',{
    errMessage: err.message
  });
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}. Rely.`));
