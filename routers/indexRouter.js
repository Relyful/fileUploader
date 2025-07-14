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
indexRouter.get('/viewFiles', indexController.getFileView);
indexRouter.get('/viewFiles/:folderId', indexController.getFolderView);
indexRouter.get('/deleteFile/:fileId', indexController.deleteFile);
indexRouter.get('/deleteFolder/:folderId', indexController.deleteFolder);
indexRouter.get('/renameFolder/:folderId', indexController.getRenameFolder);
indexRouter.post('/renameFolder/:folderId', indexController.postRenameFolder);
indexRouter.get('/viewFiles/download/:fileId', indexController.getDownloadFile);

module.exports = indexRouter;