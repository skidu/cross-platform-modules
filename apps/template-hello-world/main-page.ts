import observable = require("data/observable");
import pages = require("ui/page");
import vmModule = require("./main-view-model");

// Event handler for Page "loaded" event attached in main-page.xml
export function pageLoaded(args: observable.EventData) {
    // Get the event sender
    var page = <pages.Page>args.object;
    page.bindingContext = vmModule.mainViewModel;

    if (page.android) {
        setGradientAndroid(page);
    }
    else if (page.ios) {
        setGradientIOS(page);
    }
}

function setGradientAndroid(page: pages.Page) {
    var colorsArray = java.lang.reflect.Array.newInstance(java.lang.Integer.class.getField("TYPE").get(null), 2);

    colorsArray[0] = android.graphics.Color.parseColor("red");
    colorsArray[1] = android.graphics.Color.parseColor("blue");

    var gradient = new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM, colorsArray);
    (<android.view.ViewGroup>page.android).setBackground(gradient);
}

function setGradientIOS(page: pages.Page) {
    var pageView = (<UIViewController>page.ios).view;

    var colorsArray = NSMutableArray.alloc().initWithCapacity(2);
    colorsArray.addObject(interop.types.id(UIColor.redColor().CGColor));
    colorsArray.addObject(interop.types.id(UIColor.blueColor().CGColor));

    var gradientLayer = CAGradientLayer.layer();
    gradientLayer.colors = colorsArray;
    gradientLayer.frame = pageView.bounds;

    pageView.layer.insertSublayerAtIndex(gradientLayer, 0);
}