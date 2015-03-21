import application = require("application");

application.tabs = 
    [
        { title: "List", moduleName: "/main-page" },
        { title: "About", moduleName: "/about-page"}
    ];

// Start the application
application.start();
