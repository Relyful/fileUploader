const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const { PrismaClient, Prisma } = require("../generated/prisma");
const passport = require("passport");
const fs = require("fs");
const path = require("path");
const { prismaErrorHandler } = require("./helpers");
const {
  PrismaClientKnownRequestError,
} = require("@prisma/client/runtime/library");
const cloudinary = require("cloudinary").v2;

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

const uploadValidation = [
  body("newFileName").trim().optional({ checkFalsy: true }),
];

exports.getIndex = async (req, res) => {
  res.render("index", {
    user: req.user,
    loggedIn: req.isAuthenticated(),
  });
};

exports.getRegister = async (req, res) => {
  res.render("register", {
    loggedIn: req.isAuthenticated(),
    user: req.user,
  });
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
      console.error(err);
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        const errMessage = prismaErrorHandler(err);
        return res.render("errPage", {
          errMessage,
        });
      }
      return next(err);
    }
  },
];

exports.getLogin = async (req, res) => {
  res.render("login", {
    loggedIn: req.isAuthenticated(),
    user: req.user,
  });
};

exports.postLogin = passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/failedLogin",
});

exports.getLogout = async (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
};

exports.getUploadForm = async (req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: {
        userId: req.user.id,
      },
    });
    console.log(folders);
    res.render("uploadForm", {
      folders,
      loggedIn: req.isAuthenticated(),
      user: req.user
    });
  } catch (err) {
    console.error(err);
    if (err instanceof PrismaClientKnownRequestError) {
      const errMessage = prismaErrorHandler(err);
      return res.render("errPage", {
        errMessage,
      });
    }
  }
};

exports.postUploadForm = [
  uploadValidation,
  async (req, res, next) => {
    console.log(req.body);
    console.log(req.file);
    const data = req.body;
    const filePath = path.join(__dirname, "..", req.file.path);
    let userFileName;
    if (data.newFileName == "") {
      userFileName = req.file.filename;
    } else {
      userFileName = data.newFileName + path.extname(req.file.originalname);
    }
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        use_filename: true,
        unique_filename: false,
        overwrite: true,
      });
      console.log(result);

      await prisma.file.create({
        data: {
          fileName: req.file.filename,
          size: req.file.size,
          userFileName,
          userId: req.user.id,
          folderId: parseInt(data.folders),
          fileUrl: result.secure_url,
        },
      });
    } catch (error) {
      console.error(error);
      return next(error);
    } finally {
      //Delete after upload
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Error removing file: ${err}`);
          return;
        }
      });
    }
    res.redirect("/viewFiles");
  },
];

exports.getFolderForm = (req, res) => {
  res.render("folderForm", {
    loggedIn: req.isAuthenticated(),
    user: req.user,
  });
};

exports.postFolderForm = async (req, res) => {
  try {
    const data = req.body;
    await prisma.folder.create({
      data: {
        folderName: data.folderName,
        userId: req.user.id,
      },
    });
    res.redirect("/");
  } catch (err) {
    console.error(err);
    if (err instanceof PrismaClientKnownRequestError) {
      const errMessage = prismaErrorHandler(err);
      return res.render("errPage", {
        errMessage,
      });
    }
  }
};

exports.getFileView = async (req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: {
        userId: req.user.id,
      },
    });
    const files = await prisma.file.findMany({
      where: {
        userId: req.user.id,
        folderId: null,
      },
    });
    res.render("fileView", {
      files,
      folders,
      loggedIn: req.isAuthenticated(),
      user: req.user,
    });
  } catch (err) {
    console.error(err);
    if (err instanceof PrismaClientKnownRequestError) {
      const errMessage = prismaErrorHandler(err);
      return res.render("errPage", {
        errMessage,
      });
    }
  }
};

exports.getFolderView = async (req, res) => {
  try {
    const params = { ...req.params };
    const { userId: folderOwnerId } = await prisma.folder.findFirst({
      where: {
        id: parseInt(params.folderId),
      },
      select: {
        userId: true,
      },
    });
    if (parseInt(folderOwnerId) !== req.user.id) {
      res.status(401).send("No access");
      return;
    }
    const files = await prisma.file.findMany({
      where: {
        folderId: parseInt(params.folderId),
      },
    });
    res.render("fileView", {
      files,
      loggedIn: req.isAuthenticated(),
      user: req.user,
    });
  } catch (err) {
    console.error(err);
    if (err instanceof PrismaClientKnownRequestError) {
      const errMessage = prismaErrorHandler(err);
      return res.render("errPage", {
        errMessage,
      });
    }
  }
};

exports.deleteFile = async (req, res) => {
  try {
    const deleted = await prisma.file.delete({
      where: {
        id: parseInt(req.params.fileId),
        userId: req.user.id,
      },
    });
    const cloudDelete = await cloudinary.api.delete_resources([
      deleted.fileName.split(".")[0],
    ]); //split to remove file extension
    console.log(cloudDelete);
    res.redirect("/viewFiles");
  } catch (err) {
    console.error(err);
    if (err instanceof PrismaClientKnownRequestError) {
      const errMessage = prismaErrorHandler(err);
      return res.render("errPage", {
        errMessage,
      });
    }
  }
};

exports.deleteFolder = async (req, res) => {
  try {
    const folderToDeleteId = parseInt(req.params.folderId);
    const fileNamestoDelete = await prisma.file.findMany({
      where: {
        folderId: folderToDeleteId,
      },
      select: {
        fileName: true,
      },
    });

    await prisma.folder.delete({
      where: {
        id: folderToDeleteId,
        userId: req.user.id,
      },
    });

    fileNamestoDelete.forEach(async (file) => {
      const cloudDelete = await cloudinary.api.delete_resources([
        file.fileName.split(".")[0],
      ]); //split to remove file extension
      console.log(cloudDelete);
    });
    res.redirect("/viewFiles");
  } catch (err) {
    console.error(err);
    if (err instanceof PrismaClientKnownRequestError) {
      const errMessage = prismaErrorHandler(err);
      return res.render("errPage", {
        errMessage,
      });
    }
  }
};

exports.getRenameFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const folder = await prisma.folder.findFirst({
      where: {
        id: parseInt(folderId),
        userId: req.user.id,
      },
    });
    if (!folder) {
      return res.status(404).send("Folder not found.");
    }
    const { folderName, id } = folder;
    res.render("renameFolder", {
      originalName: folderName,
      folderId: id,
      loggedIn: req.isAuthenticated(),
      user: req.user,
    });
  } catch (err) {
    console.error(err);
    if (err instanceof PrismaClientKnownRequestError) {
      const errMessage = prismaErrorHandler(err);
      return res.render("errPage", {
        errMessage,
      });
    }
  }
};

exports.postRenameFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const data = req.body;
    //Folder check
    const folderCheck = prisma.folder.findFirst({
      where: {
        id: parseInt(folderId),
        userId: req.user.id,
      },
    });
    if (!folderCheck) {
      return res.status(404).send("Folder not found.");
    }

    const folder = await prisma.folder.update({
      where: {
        id: parseInt(folderId),
      },
      data: {
        folderName: data.folderName,
      },
    });
    if (!folder) {
      res.send(":(");
      return;
    }
    res.redirect("/viewFiles");
  } catch (err) {
    console.error(err);
    if (err instanceof PrismaClientKnownRequestError) {
      const errMessage = prismaErrorHandler(err);
      return res.render("errPage", {
        errMessage,
      });
    }
  }
};
