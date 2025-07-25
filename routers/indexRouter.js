const { Router } = require('express');
const indexController = require('../controllers/indexController');
const { authMiddleware } = require('../controllers/middleware');
const path = require('path');
const multer  = require('multer');

const indexRouter = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Appends extension
  }
});

const upload = multer({ storage: storage }); // Create multer for upload dir

indexRouter.get('/', indexController.getIndex);
indexRouter.get('/register', indexController.getRegister);
indexRouter.post('/register', indexController.postRegister);
indexRouter.get('/login', indexController.getLogin);
indexRouter.post('/login', indexController.postLogin);
indexRouter.get('/logout', indexController.getLogout);
indexRouter.get('/upload', authMiddleware, indexController.getUploadForm);
indexRouter.post('/upload', authMiddleware, upload.single('myfile'), indexController.postUploadForm);
indexRouter.get('/createFolder', authMiddleware, indexController.getFolderForm);
indexRouter.post('/createFolder', authMiddleware, indexController.postFolderForm);
indexRouter.get('/viewFiles', authMiddleware, indexController.getFileView);
indexRouter.get('/viewFiles/:folderId', authMiddleware, indexController.getFolderView);
indexRouter.get('/deleteFile/:fileId', authMiddleware, indexController.deleteFile);
indexRouter.get('/deleteFolder/:folderId', authMiddleware, indexController.deleteFolder);
indexRouter.get('/renameFolder/:folderId', authMiddleware, indexController.getRenameFolder);
indexRouter.post('/renameFolder/:folderId', authMiddleware, indexController.postRenameFolder);
indexRouter.get('/failedLogin', (req, res) => res.render('errPage', { errMessage: "Wrong username or password"}));

module.exports = indexRouter;