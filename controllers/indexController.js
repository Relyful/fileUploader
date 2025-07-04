const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("../generated/prisma");
const passport = require("passport");

const prisma = new PrismaClient(); // Prisma uses its own pool internally

const registerValidation = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username cannot be empty")
    .isAscii()
    .withMessage("First Name must contain valid ASCII characters."),
  body("confirmPassword")
    .custom((value, { req }) => {
      return value === req.body.password;
    })
    .withMessage("Passwords must match!"),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password can not be empty.")
    .isLength({ min: 5 })
    .withMessage("Password must be atleast 5 characters long."),
];

exports.getIndex = async (req, res) => {
  res.render("index");
};

exports.getRegister = async (req, res) => {
  res.render("register");
};

exports.postRegister = [
  registerValidation,
  async (req, res, next) => {
    const data = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).render("register", {
        errors: errors.errors,
        loggedIn: req.isAuthenticated(),
      });
      return;
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const role = data.admin ? "ADMIN" : "USER";

    try {
      let result = await prisma.user.create({
        data: {
          username: data.username,
          password: hashedPassword,
          role,
        },
      });
      console.log(result);
      res.redirect("/login");
    } catch (err) {
      if (err.code && err.code === "23505") {
        return res.status(400).render("registerForm", {
          errors: [{ msg: "Username already exists." }],
          loggedIn: req.isAuthenticated(),
          user: req.user,
        });
      }
      return next(err);
    }
  },
];

exports.getLogin = async (req, res) => {
  res.render('login');
}

exports.postLogin = passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login'
})

exports.getLogout = async (req, res, next) => {
  req.logout((err) => {
    if (err) {return next(err);}
    res.redirect('/');
  })
}