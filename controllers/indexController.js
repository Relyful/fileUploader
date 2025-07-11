const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("../generated/prisma");
const passport = require("passport");
const fs = require('fs');
const path = require('path');

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
  res.render("index", {
    user: req.user
  });
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
        return res.status(400).render("register", {
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

exports.getUploadForm = async (req, res) => {
  const folders = await prisma.folder.findMany({
    where: {
      userId: req.user.id
    }
  });
  console.log(folders)
  res.render('uploadForm', {
    folders
});
}

exports.postUploadForm = async (req, res) => {
  console.log(req.body);
  const data = req.body;
  await prisma.file.create({
    data: {
      fileName: req.file.filename,  
      userId: req.user.id,
      folderId: parseInt(data.folders)
    }
  })
  res.redirect('/viewFiles');
}

exports.getFolderForm = (req, res) => {  
  res.render('folderForm');
}

exports.postFolderForm = async (req, res) => {
  const data = req.body;
  await prisma.folder.create({
    data: {
      folderName: data.folderName,
      userId: req.user.id
    }
  })
  res.redirect('/');
}

exports.getFileView = async (req, res) => {
  const folders = await prisma.folder.findMany({
    where: {
      userId: req.user.id
    }
  });
  const files = await prisma.file.findMany({
    where: {
      userId: req.user.id,
      folderId: null
    }
  })
  res.render('fileView', {
    files,
    folders
  })
}

exports.getFolderView = async (req, res) => {
  const params = {...req.params};
  const { userId: folderOwnerId } = await prisma.folder.findFirst({
    where: {
      id: parseInt(params.folderId)
    },
    select: {
      userId: true
    }
  });
  if (parseInt(folderOwnerId) !== req.user.id) {
    res.status(401).send('No access');
    return;
  }
  const files = await prisma.file.findMany({
    where: {
      folderId: parseInt(params.folderId)
    }
  })  
  res.render('fileView', {
    files
  })
}

exports.deleteFile = async (req, res) => {
  const deleted = await prisma.file.delete({
    where: {
      id: parseInt(req.params.fileId),
      userId: req.user.id
    }
  });
  const deletePath = path.join(__dirname, '..', 'uploads', deleted.fileName);
  fs.unlink(deletePath, (err) => {
    if (err) {
      console.error(`Error removing file: ${err}`);
      return;
    }
  });
  res.redirect('/viewFiles');
}

exports.deleteFolder = async (req, res) => {
  const folderToDeleteId = parseInt(req.params.folderId);
  const fileNamestoDelete = await prisma.file.findMany({
    where: {
      folderId: folderToDeleteId
    },
    select: {
      fileName: true
    }
  });

  await prisma.folder.delete({
    where: {
      id: folderToDeleteId,
      userId: req.user.id
    }
  });

  fileNamestoDelete.forEach((file) => {
    const pathToDelete = path.join(__dirname, '..', 'uploads', file.fileName);
    fs.unlink(pathToDelete, (err) => {
      if (err) {
        console.error(err);
        return;
      }
    })
  });
  res.redirect('/viewFiles');
}

exports.getRenameFolder = async (req, res) => {
  const { folderId } = req.params;
  const { folderName, id } = await prisma.folder.findFirst({
    where: {
      id: parseInt(folderId),
      userId: req.user.id
    }
  });
  res.render('renameFolder', {
    originalName: folderName,
    folderId: id
  })
}

exports.postRenameFolder = async (req, res) => {
  const { folderId } = req.params;
  const data = req.body;
  const folder = await prisma.folder.update({
    where: {
      id: parseInt(folderId),
      userId: req.user.id
    },
    data: {
      folderName: data.folderName
    }
  })
  if (!folder) {
    res.send(':(');
    return;
  }
  res.redirect('/viewFiles');
};