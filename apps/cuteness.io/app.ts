import application = require("application");

application.tabs = 
    [
        { title: "List", moduleName: "app/main-page" },
        { title: "About", moduleName: "app/about-page"}
    ];

// Start the application
application.start();
