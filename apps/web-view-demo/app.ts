﻿import application = require("application");
application.mainModule = "main-page";

import trace = require("trace");
trace.enable();
trace.setCategories(trace.categories.concat(trace.categories.Debug));

application.start();
