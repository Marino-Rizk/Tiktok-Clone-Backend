exports.home = (req, res) => {
  res.sendFile(require('path').join(__dirname, '../views/home.html'));
}; 