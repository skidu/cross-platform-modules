﻿import frameCommon = require("ui/frame/frame-common");
import definition = require("ui/frame");
import pages = require("ui/page");
import trace = require("trace");
import observable = require("data/observable");
import utils = require("utils/utils");
import view = require("ui/core/view");
import application = require("application");

declare var exports;
require("utils/module-merge").merge(frameCommon, exports);

var TAG = "_fragmentTag";
var OWNER = "_owner";
var HIDDEN = "_hidden";
var INTENT_EXTRA = "com.tns.activity";

var navDepth = 0;

class PageFragmentBody extends android.app.Fragment {
    public frame: Frame;
    public entry: definition.BackstackEntry;

    constructor(frame: Frame, entry: definition.BackstackEntry) {
        super();

        this.frame = frame;
        this.entry = entry;
        return global.__native(this);
    }

    onAttach(activity: android.app.Activity) {
        super.onAttach(activity);
        trace.write(this.getTag() + ".onAttach();", trace.categories.NativeLifecycle);
    }

    onCreate(savedInstanceState: android.os.Bundle) {
        super.onCreate(savedInstanceState);
        trace.write(this.getTag() + ".onCreate(); savedInstanceState: " + savedInstanceState, trace.categories.NativeLifecycle);
    }

    onCreateView(inflater: android.view.LayoutInflater, container: android.view.ViewGroup, savedInstanceState: android.os.Bundle): android.view.View {
        trace.write(this.getTag() + ".onCreateView(); container: " + container + "; savedInstanceState: " + savedInstanceState, trace.categories.NativeLifecycle);
        var entry: definition.BackstackEntry = this.entry;
        var page: pages.Page = entry.resolvedPage;

        if (savedInstanceState && savedInstanceState.getBoolean(HIDDEN, false)) {
            // Manually hide the fragment if it was hidden before as Android will not do this every time. 
            super.getFragmentManager().beginTransaction().hide(this).commit();

            // As the page will not be added to the frame it won't be attached
            // We should attach it manually so that it creates its nativeView
            page._onAttached(this.getActivity());
        }
        else {
            onFragmentShown(this);
        }

        trace.write(this.getTag() + ".onCreateView(); nativeView: " + page._nativeView, trace.categories.NativeLifecycle);
        return page._nativeView;
    }

    onHiddenChanged(hidden: boolean) {
        super.onHiddenChanged(hidden);
        trace.write(this.getTag() + ".onHiddenChanged(); hidden: " + hidden, trace.categories.NativeLifecycle);

        if (hidden) {
            onFragmentHidden(this);
        }
        else {
            onFragmentShown(this);
        }
    }

    onActivityCreated(savedInstanceState: android.os.Bundle) {
        super.onActivityCreated(savedInstanceState);
        trace.write(this.getTag() + ".onActivityCreated(); savedInstanceState: " + savedInstanceState, trace.categories.NativeLifecycle);
    }

    onSaveInstanceState(outState: android.os.Bundle) {
        super.onSaveInstanceState(outState);
        trace.write(this.getTag() + ".onSaveInstanceState();", trace.categories.NativeLifecycle);

        if (this.isHidden()) {
            outState.putBoolean(HIDDEN, true);
        }
    }

    onViewStateRestored(savedInstanceState: android.os.Bundle) {
        super.onViewStateRestored(savedInstanceState);
        trace.write(this.getTag() + ".onViewStateRestored(); savedInstanceState: " + savedInstanceState, trace.categories.NativeLifecycle);
    }

    onStart() {
        super.onStart();
        trace.write(this.getTag() + ".onStart();", trace.categories.NativeLifecycle);
    }

    onResume() {
        super.onResume();
        trace.write(this.getTag() + ".onResume();", trace.categories.NativeLifecycle);
    }

    onPause() {
        super.onPause();
        trace.write(this.getTag() + ".onPause();", trace.categories.NativeLifecycle);
    }

    onStop() {
        super.onStop();
        trace.write(this.getTag() + ".onStop();", trace.categories.NativeLifecycle);
    }

    onDestroyView() {
        super.onDestroyView();
        trace.write(this.getTag() + ".onDestroyView();", trace.categories.NativeLifecycle);

        onFragmentHidden(this);
    }

    onDestroy() {
        super.onDestroy();
        trace.write(this.getTag() + ".onDestroy();", trace.categories.NativeLifecycle);

        // Explicitly free resources to allow Java Garbage collector to release resources associated with JavaScript implementations - e.g. large image files.
        // Although we hint the V8 with the externally allocated memory, synchronization between the two GCs is not deterministic without an explicit call.
        // TODO: Revisit this explicit Garbage Collector call when possible.
        utils.GC();
    }

    onDetach() {
        super.onDetach();
        trace.write(this.getTag() + ".onDetach();", trace.categories.NativeLifecycle);
    }
}

function onFragmentShown(fragment: PageFragmentBody) {
    // TODO: consider putting entry and page in queue so we can safely extract them here. Pass the index of current navigation and extract it from here.
    // After extracting navigation info - remove this index from navigation stack.
    var frame = fragment.frame;
    var entry: definition.BackstackEntry = fragment.entry;
    var page: pages.Page = entry.resolvedPage;

    frame._currentEntry = entry;

    // notify the page
    frame._addView(page);
    page.onNavigatedTo(entry.entry.context);
    frame._processNavigationQueue(page);

    // Select the respective application tab if needed.
    var actionBar = fragment.getActivity().getActionBar();
    if (actionBar && application.tabs && entry.entry.moduleName) {
        var i: number = 0;
        var length = application.tabs.length;
        var item: application.ApplicationTab;
        var tab: android.app.ActionBar.Tab;
        for (i; i < length; i++) {
            item = application.tabs[i];
            if (item.moduleName === entry.entry.moduleName) {
                actionBar.setSelectedNavigationItem(i);
            }
        }
    }
}

function onFragmentHidden(fragment: PageFragmentBody) {
    var entry: definition.BackstackEntry = fragment.entry;
    var page: pages.Page = entry.resolvedPage;
    // This might be a second call if the fragment is hidden and then destroyed.
    if (page && page.frame) {
        var frame = page.frame;
        frame._removeView(page);
    }
}

export class Frame extends frameCommon.Frame {
    private _android: AndroidFrame;
    private _delayedNavigationEntry: definition.BackstackEntry;
    private _isFirstNavigation = false;
    private _containerViewId: number;

    constructor() {
        super();
        this._containerViewId = android.view.View.generateViewId();
        this._android = new AndroidFrame(this);
    }

    public static get defaultAnimatedNavigation(): boolean {
        return frameCommon.Frame.defaultAnimatedNavigation;
    }
    public static set defaultAnimatedNavigation(value: boolean) {
        frameCommon.Frame.defaultAnimatedNavigation = value;
    }

    get containerViewId(): number {
        return this._containerViewId;
    }

    get android(): definition.AndroidFrame {
        return this._android;
    }

    get _nativeView(): any {
        return this._android.rootViewGroup;
    }

    public _navigateCore(backstackEntry: definition.BackstackEntry) {
        var activity = this._android.activity;
        if (!activity) {
            // We do not have an Activity yet associated. In this case we have two execution paths:
            // 1. This is the main frame for the application
            // 2. This is an inner frame which requires a new Activity
            var currentActivity = this._android.currentActivity;
            if (currentActivity) {
                startActivity(currentActivity, backstackEntry.entry);
            }

            this._delayedNavigationEntry = backstackEntry;
            return;
        }

        var manager = activity.getFragmentManager();
        var fragmentTransaction = manager.beginTransaction();

        var newFragmentTag = "fragment" + this.backStack.length;
        var newFragment = new PageFragmentBody(this, backstackEntry);

        // remember the fragment tag at page level so that we can retrieve the fragment associated with a Page instance
        backstackEntry.resolvedPage[TAG] = newFragmentTag;

        navDepth++;
        trace.write("Frame<" + this._domId + ">.fragmentTransaction PUSH depth = " + navDepth, trace.categories.Navigation);

        if (this._isFirstNavigation) {
            fragmentTransaction.add(this.containerViewId, newFragment, newFragmentTag);
            trace.write("fragmentTransaction.add(" + this.containerViewId + ", " + newFragment + ", " + newFragmentTag + ");", trace.categories.NativeLifecycle);
        }
        else {
            if (this.android.cachePagesOnNavigate) {
                var currentFragmentTag = this.currentPage[TAG];
                var currentFragment = manager.findFragmentByTag(currentFragmentTag);
                if (currentFragment) {
                    fragmentTransaction.hide(currentFragment);
                    trace.write("fragmentTransaction.hide(" + currentFragment + ");", trace.categories.NativeLifecycle);
                }
                else {
                    trace.write("Could not find " + currentFragmentTag + " to hide", trace.categories.NativeLifecycle);
                }

                fragmentTransaction.add(this.containerViewId, newFragment, newFragmentTag);
                trace.write("fragmentTransaction.add(" + this.containerViewId + ", " + newFragment + ", " + newFragmentTag + ");", trace.categories.NativeLifecycle);
            }
            else {
                fragmentTransaction.replace(this.containerViewId, newFragment, newFragmentTag);
                trace.write("fragmentTransaction.replace(" + this.containerViewId + ", " + newFragment + ", " + newFragmentTag + ");", trace.categories.NativeLifecycle);
            }

            if (this.backStack.length > 0) {
                fragmentTransaction.addToBackStack(newFragmentTag);
                trace.write("fragmentTransaction.addToBackStack(" + newFragmentTag + ");", trace.categories.NativeLifecycle);
            }
        }

        if (!this._isFirstNavigation) {
            var animated = this._getIsAnimatedNavigation(backstackEntry.entry);

            if (this.android.cachePagesOnNavigate) {
                // Apparently, there is an Android bug with when hiding fragments with animation.
                // https://code.google.com/p/android/issues/detail?id=32405
                // When bug is fixed use animated variable.
                fragmentTransaction.setTransition(android.app.FragmentTransaction.TRANSIT_NONE);
            }
            else {
                var transition = animated ? android.app.FragmentTransaction.TRANSIT_FRAGMENT_OPEN : android.app.FragmentTransaction.TRANSIT_NONE;
                fragmentTransaction.setTransition(transition);
            }
        }

        fragmentTransaction.commit();
        trace.write("fragmentTransaction.commit();", trace.categories.NativeLifecycle);
    }

    public _goBackCore(entry: definition.NavigationEntry) {
        navDepth--;
        trace.write("Frame<" + this._domId + ">.fragmentTransaction POP depth = " + navDepth, trace.categories.Navigation);

        var manager = this._android.activity.getFragmentManager();
        if (manager.getBackStackEntryCount() > 0) {
            manager.popBackStack();
        }
    }

    public _createUI() {
        // TODO: Implement for nested frames
        // this._android.layout = new android.widget.FrameLayout(this._context);
        // this._android.layout.setId(android.view.View.generateViewId());
    }

    public _onActivityCreated(isRestart: boolean) {
        this._onAttached(this._android.activity);

        var backstackEntry = this.currentEntry || this._delayedNavigationEntry;

        if (isRestart) {
            this._onNavigatingTo(backstackEntry);
            this._onNavigatedTo(backstackEntry, false);
        }
        else {
            this._isFirstNavigation = true;
            this._navigateCore(backstackEntry);
            this._isFirstNavigation = false;
        }

        this._delayedNavigationEntry = undefined;
    }

    public _popFromFrameStack() {
        if (!this._isInFrameStack) {
            return;
        }

        super._popFromFrameStack();
        if (this._android.hasOwnActivity) {
            this._android.activity.finish();
        }
    }

    public _clearAndroidReference() {
        // we should keep the reference to underlying native object, since frame can contain many pages.
    }
}

declare module com {
    module tns {
        class NativeScriptActivity extends android.app.Activity {
            protected onCreate(savedInstanceState: android.os.Bundle);
            protected onStart();
            protected onStop();
            protected onDestroy();
            protected onActivityResult(requestCode: number, resultCode: number, data: android.content.Intent)
        }
    }
}

class NativeActivity extends com.tns.NativeScriptActivity {
    private androidFrame: AndroidFrame;
    private get frame(): Frame {
        if (this.androidFrame) {
            return this.androidFrame.owner;
        }
        return null;
    }

    onCreate(savedInstanceState: android.os.Bundle) {
        trace.write("NativeScriptActivity.onCreate(); savedInstanceState: " + savedInstanceState, trace.categories.NativeLifecycle);

        // Find the frame for this activity.
        var frameId = this.getIntent().getExtras().getInt(INTENT_EXTRA);
        for (var i = 0; i < framesCache.length; i++) {
            var aliveFrame = framesCache[i].get();
            if (aliveFrame && aliveFrame.frameId === frameId) {
                this.androidFrame = aliveFrame;
                break;
            }
        }

        if (!this.androidFrame) {
            throw new Error("Could not find AndroidFrame for Activity");
        }

        // If there is savedInstanceState this call will recreate all fragments that were previously in the navigation.
        // We take care of associating them with a Page from our backstack in the onAttachFragment callback.
        super.onCreate(savedInstanceState);

        this.androidFrame.setActivity(this);

        // Create and set content container.
        var root = new view.NativeViewGroup(this);
        root[OWNER] = this.frame;

        this.androidFrame.rootViewGroup = root;
        this.androidFrame.rootViewGroup.setId(this.frame.containerViewId);
        this.setContentView(this.androidFrame.rootViewGroup);

        // If there is no instance state - we call navigateCore from here since Activity is created AFTER the navigate call and navigateCore will fail.
        var isRestart = !!savedInstanceState;
        this.frame._onActivityCreated(isRestart);
    }

    onActivityResult(requestCode: number, resultCode: number, data: android.content.Intent) {
        super.onActivityResult(requestCode, resultCode, data);
        trace.write("NativeScriptActivity.onActivityResult();", trace.categories.NativeLifecycle);

        var result = application.android.onActivityResult;
        if (result) {
            result(requestCode, resultCode, data);
        }
    }

    onAttachFragment(fragment: android.app.Fragment) {
        trace.write("NativeScriptActivity.onAttachFragment() : " + fragment.getTag(), trace.categories.NativeLifecycle);
        super.onAttachFragment(fragment);

        if (!(<PageFragmentBody>fragment).entry) {
            // There is no entry set to the fragment, so this must be destroyed fragment that was recreated by Android.
            // We should find its corresponding page in our backstack and set it manually.
            findPageForFragment(fragment, this.frame);
        }
    }

    onStart() {
        super.onStart();
        trace.write("NativeScriptActivity.onStart();", trace.categories.NativeLifecycle);
        this.frame.onLoaded();
    }

    onStop() {
        super.onStop();
        trace.write("NativeScriptActivity.onStop();", trace.categories.NativeLifecycle);
        this.frame.onUnloaded();
    }

    onDestroy() {
        // TODO: Implement uninitialized(detached) routine
        var frame = this.frame;
        frame._onDetached(true);

        // There might be cached pages in the backstack - force detach them too.
        for (var i = 0; i < frame.backStack.length; i++) {
            frame.backStack[i].resolvedPage._onDetached(true);
        }

        this.androidFrame.reset();

        super.onDestroy();
        trace.write("NativeScriptActivity.onDestroy();", trace.categories.NativeLifecycle);
    }

    onOptionsItemSelected(menuItem) {
        if (!this.androidFrame.hasListeners(frameCommon.knownEvents.android.optionSelected)) {
            return false;
        }

        var data: definition.AndroidOptionEventData = {
            handled: false,
            eventName: frameCommon.knownEvents.android.optionSelected,
            item: menuItem,
            object: this.androidFrame
        }

        this.androidFrame.notify(data);
        return data.handled;
    }

    onBackPressed() {
        trace.write("NativeScriptActivity.onBackPressed;", trace.categories.NativeLifecycle);
        if (!frameCommon.goBack()) {
            super.onBackPressed();
        }
    }

    onLowMemory() {
        gc();
        java.lang.System.gc();
        super.onLowMemory();
    }

    onTrimMemory(level) {
        gc();
        java.lang.System.gc();
        super.onTrimMemory(level);
    }
}

var framesCounter = 0;
var framesCache: Array<WeakRef<AndroidFrame>> = new Array<WeakRef<AndroidFrame>>();

class AndroidFrame extends observable.Observable implements definition.AndroidFrame {
    public rootViewGroup: android.view.ViewGroup;
    public hasOwnActivity = false;
    public showActionBar = false;
    public frameId;

    private _activity: android.app.Activity;
    private _owner: Frame;
    private _cachePagesOnNavigate: boolean;

    constructor(owner: Frame) {
        super();
        this._owner = owner;
        this.frameId = framesCounter++;
        framesCache.push(new WeakRef(this));
    }

    public get activity(): android.app.Activity {
        if (this._activity) {
            return this._activity;
        }

        // traverse the parent chain for an ancestor Frame
        var currView = this._owner.parent;
        while (currView) {
            if (currView instanceof Frame) {
                return (<Frame>currView).android.activity;
            }

            currView = currView.parent;
        }

        return undefined;
    }

    public get actionBar(): android.app.ActionBar {
        var activity = this.currentActivity;
        if (!activity) {
            return undefined;
        }

        var bar = activity.getActionBar();
        if (!bar) {
            return undefined;
        }

        return bar;
    }

    public get currentActivity(): android.app.Activity {
        var activity = this.activity;
        if (activity) {
            return activity;
        }

        var stack = frameCommon.stack(),
            length = stack.length,
            i = length - 1,
            frame: definition.Frame;

        for (i; i >= 0; i--) {
            frame = stack[i];
            activity = frame.android.activity;
            if (activity) {
                return activity;
            }
        }

        return undefined;
    }

    public get owner(): Frame {
        return this._owner;
    }

    public get cachePagesOnNavigate(): boolean {
        return this._cachePagesOnNavigate;
    }

    public set cachePagesOnNavigate(value: boolean) {
        if (this._cachePagesOnNavigate !== value) {
            if (this._owner.backStack.length > 0) {
                throw new Error("Cannot set cachePagesOnNavigate if there are items in the back stack.");
            }

            this._cachePagesOnNavigate = value;
        }
    }

    public onActivityRequested(intent: android.content.Intent): Object {
        if (this.activity) {
            throw new Error("Frame already attached to an Activity");
        }

        intent.putExtra(INTENT_EXTRA, this.frameId);
        this.hasOwnActivity = true;
        return this.createActivity(intent);
    }

    public canGoBack() {
        if (!this._activity) {
            return false;
        }

        // can go back only if it is not the main one.
        return this._activity.getIntent().Action !== android.content.Intent.ACTION_MAIN;
    }

    public reset() {
        // TODO: Cleanup, do we need more?
        delete this.rootViewGroup[OWNER];
        this._activity = undefined;
        this.rootViewGroup = undefined;
    }

    public setActivity(value: android.app.Activity) {
        this._activity = value;
    }

    private createActivity(intent: android.content.Intent) {
        // TODO: check intent
        return NativeActivity;
    }
}

function findPageForFragment(fragment: android.app.Fragment, frame: Frame) {
    var fragmentTag = fragment.getTag();
    var page: pages.Page;
    var entry: definition.BackstackEntry;

    trace.write("Attached fragment with no page: " + fragmentTag, trace.categories.NativeLifecycle);
    if (frame.currentPage && frame.currentPage[TAG] === fragmentTag) {
        page = frame.currentPage;
        entry = frame.currentEntry;
        trace.write("Current page matches fragment: " + fragmentTag, trace.categories.NativeLifecycle);
    }
    else {
        for (var i = 0; i < frame.backStack.length; i++) {
            entry = frame.backStack[i];
            if (frame.backStack[i].resolvedPage[TAG] === fragmentTag) {
                entry = frame.backStack[i];
                break;
            }
        }
        if (entry) {
            trace.write("Found entry:" + entry + " for fragment: " + fragmentTag, trace.categories.NativeLifecycle);
            page = entry.resolvedPage;
        }
    }
    if (page) {
        (<PageFragmentBody>fragment).frame = frame;
        (<PageFragmentBody>fragment).entry = entry;

        page[TAG] = fragmentTag;
    }
    else {
        //throw new Error("Could not find Page for Fragment.");
    }
}

function startActivity(activity: android.app.Activity, entry: definition.NavigationEntry) {
    var intent = new android.content.Intent(activity, (<any>com).tns.NativeScriptActivity.class);
    intent.Action = android.content.Intent.ACTION_DEFAULT;
    // TODO: Put the navigation context (if any) in the intent
    activity.startActivity(intent);
}