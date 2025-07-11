const upload = require("../utils/upload");

module.exports = {
  webAuthenticated: (req, res, next) => {
    if (req.session.user) {
      return next();
    } else {
      res.redirect("/login");
    }
  },
  ensureGuest: (req, res, next) => {
    if (!req.session.user) {
      return res.redirect("/users/login");
    }
    next();
  },
  pageSettings: (req, res, next) => {
    let showHeader = true;
    let showFooter = true;
    let title = "";
    let menu_item = "";

    if (req.path === "/login") {
      showHeader = false;
      showFooter = false;
      title = "Login";
    }

    if (req.path === "/register") {
      showHeader = false;
      showFooter = false;
      title = "Register";
    }

    if (req.path === "/") {
      title = "Dashboard";
      menu_item = "Dashboards";
    }

    res.locals.showHeader = showHeader;
    res.locals.showFooter = showFooter;
    res.locals.title = title;
    res.locals.menu_item = menu_item;
    next();
  },
};
