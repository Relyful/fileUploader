exports.userCheck = (req) => {
  const params = {...req.params};
  if(parseInt(params.userId) !== req.user.id) {
    return true;
  } else {
    return false;
  }
}