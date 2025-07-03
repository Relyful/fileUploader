const { Router } = require('express');
const indexController = require('../controllers/indexController');

const indexRouter = Router();

indexRouter.get('/', indexController.getIndex);
indexRouter.get('/register', indexController.getRegister);

module.exports = indexRouter;