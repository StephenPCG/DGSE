const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Main = imports.ui.main;
const Layout = imports.ui.layout;
const Tweener = imports.ui.tweener;
const Overview = imports.ui.overview;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const Signals = imports.signals;
const Meta = imports.gi.Meta;
const AppDisplay = imports.ui.appDisplay;
const AltTab = imports.ui.altTab;
const Gio = imports.gi.Gio;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const PANEL_ICON_SIZE = 24;
const SPINNER_ANIMATION_TIME = 1;


function AppMenuButtonRightClickMenu(actor, app, metaWindow) {
    this._init(actor, app, metaWindow);
}

AppMenuButtonRightClickMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(actor, app, metaWindow) {
        //take care of menu initialization
        if (bottomPosition)
            PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.0, St.Side.BOTTOM, 0);
        else
            PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.0, St.Side.TOP, 0);
        Main.uiGroup.add_actor(this.actor);
        //Main.chrome.addActor(this.actor, { visibleInOverview: true,
        //                                   affectsStruts: false });
        this.actor.hide();
        actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));

        this.metaWindow = metaWindow;
        this.app = app;

        this.itemCloseWindow = new PopupMenu.PopupMenuItem('Close');
        this.itemCloseWindow.connect('activate', Lang.bind(this, this._onCloseWindowActivate));        
        if (metaWindow.minimized)
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem('Restore');
        else
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem('Minimize');
        this.itemMinimizeWindow.connect('activate', Lang.bind(this, this._onMinimizeWindowActivate));        
        if (metaWindow.get_maximized())
            this.itemMaximizeWindow = new PopupMenu.PopupMenuItem(_("Unmaximize"));
        else
            this.itemMaximizeWindow = new PopupMenu.PopupMenuItem(_('Maximize'));
        this.itemMaximizeWindow.connect('activate', Lang.bind(this, this._onMaximizeWindowActivate));        
        
        if (bottomPosition) {
            this.addMenuItem(this.itemMinimizeWindow);
            this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemCloseWindow);                        
        }
        else {
            this.addMenuItem(this.itemCloseWindow);
            this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemMinimizeWindow);
        }            
    },
    
    _onWindowMinimized: function(actor, event){
    },

    _onCloseWindowActivate: function(actor, event){
        this.metaWindow.delete(global.get_current_time());
    },

    _onMinimizeWindowActivate: function(actor, event){
        if (this.metaWindow.minimized)
            this.metaWindow.unminimize(global.get_current_time());
        else
            this.metaWindow.minimize(global.get_current_time());
    },

    _onMaximizeWindowActivate: function(actor, event){      
        // 3 = 1 | 2 for both horizontally and vertically (didn't find where the META_MAXIMIZE_HORIZONTAL and META_MAXIMIZE_VERTICAL constants were defined for the JS wrappers)
        if (this.metaWindow.get_maximized()){
            this.metaWindow.unmaximize(3);
            this.itemMaximizeWindow.label.set_text(_("Maximize"));
        }else{
            this.metaWindow.maximize(3);
            this.itemMaximizeWindow.label.set_text(_("Unmaximize"));
        }
    },

    _onSourceKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen)
                this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;
    }

};

function AppMenuButton(app, metaWindow, animation) {
    this._init(app, metaWindow, animation);
}

AppMenuButton.prototype = {
//    __proto__ : AppMenuButton.prototype,

    
    _init: function(app, metaWindow, animation) {

        if (bottomPosition) {        
            this.actor = new St.Bin({ style_class: 'window-list-item-box-bottom',
                                      reactive: true,
                                      can_focus: true,
                                      x_fill: true,
                                      y_fill: false,
                                      track_hover: true });
        }
        else {
            this.actor = new St.Bin({ style_class: 'window-list-item-box',
                                      reactive: true,
                                      can_focus: true,
                                      x_fill: true,
                                      y_fill: false,
                                      track_hover: true });
        }
        
        this.actor._delegate = this;
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));

		this.metaWindow = metaWindow;
		this.app = app;
		
        let bin = new St.Bin({ name: 'appMenu' });
        this.actor.set_child(bin);

        this._container = new Shell.GenericContainer();
        bin.set_child(this._container);
        this._container.connect('get-preferred-width',
								Lang.bind(this, this._getContentPreferredWidth));
        this._container.connect('get-preferred-height',
								Lang.bind(this, this._getContentPreferredHeight));
        this._container.connect('allocate', Lang.bind(this, this._contentAllocate));

        
        this._iconBox = new Shell.Slicer({ name: 'appMenuIcon' });
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClip));
        this._container.add_actor(this._iconBox);
        this._label = new St.Label();
        this._container.add_actor(this._label);

        this._iconBottomClip = 0;

        this._visible = !Main.overview.visible;
        if (!this._visible)
            this.actor.hide();
        Main.overview.connect('hiding', Lang.bind(this, function () {
            this.show();
        }));
        Main.overview.connect('showing', Lang.bind(this, function () {
            this.hide();
        }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
        
        this._updateCaptionId = this.metaWindow.connect('notify::title', Lang.bind(this, function () {
            this._label.set_text(this.metaWindow.get_title());
        }));
                
        this._spinner = new Panel.AnimatedIcon('process-working.svg', PANEL_ICON_SIZE);
        this._container.add_actor(this._spinner.actor);
        this._spinner.actor.lower_bottom();

		let icon = this.app.create_icon_texture(16);
		//let icon = this.app.get_faded_icon(1.15 * PANEL_ICON_SIZE);		        
        this._label.set_text(this.metaWindow.get_title());
        this._iconBox.set_child(icon);
        
        if(animation){
			this.startAnimation(); 
			this.stopAnimation();
		}
        
        //set up the right click menu
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this.rightClickMenu = new AppMenuButtonRightClickMenu(this.actor, this.app, this.metaWindow);
        this._menuManager.addMenu(this.rightClickMenu);
    },
    
    _onDestroy: function() {
        this.metaWindow.disconnect(this._updateCaptionId);
    },
    
    doFocus: function() {
        //let tracker = Shell.WindowTracker.get_default();
        //let focusedApp = tracker.focus_app;    
        if (this.metaWindow.has_focus()) {
            this.actor.add_style_pseudo_class('focus');
	    let icon = this.app.create_icon_texture(16);
	    this._iconBox.set_child(icon);
        }
        else {
            this.actor.remove_style_pseudo_class('focus');
	    let icon = this.app.create_icon_texture(16);
	    this._iconBox.set_child(icon);
        }
    },
    
    _onButtonRelease: function(actor, event) {
        if ( Shell.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK ) {
            if ( this.rightClickMenu.isOpen ) {
                this.rightClickMenu.toggle();                
            }
            if ( this.metaWindow.has_focus() ) {
                this.metaWindow.minimize(global.get_current_time());
                this.actor.remove_style_pseudo_class('focus');
            }
            else {
                this.metaWindow.activate(global.get_current_time());
                this.actor.add_style_pseudo_class('focus');	    
            }
        } else if (Shell.get_event_state(event) & Clutter.ModifierType.BUTTON3_MASK) {
            if (!this.rightClickMenu.isOpen) {
                // Setting the max-height won't do any good if the minimum height of the
                // menu is higher then the screen; it's useful if part of the menu is
                // scrollable so the minimum height is smaller than the natural height
                //let monitor = global.get_primary_monitor();
                //this.rightClickMenu.actor.style = ('max-height: ' +
                //                         Math.round(200) +
                //                         'px;');
            }
            this.rightClickMenu.toggle();   
        }   
    },
    
    show: function() {
        if (this._visible)
            return;
        this._visible = true;
        this.actor.show();
    },

    hide: function() {
        if (!this._visible)
            return;
        this._visible = false;
        this.actor.hide();
    },

    _onIconBoxStyleChanged: function() {
        let node = this._iconBox.get_theme_node();
        this._iconBottomClip = node.get_length('app-icon-bottom-clip');
        this._updateIconBoxClip();
    },

    _updateIconBoxClip: function() {
        let allocation = this._iconBox.allocation;
       if (this._iconBottomClip > 0)
           this._iconBox.set_clip(0, 0,
                                 allocation.x2 - allocation.x1,
                                   allocation.y2 - allocation.y1 - this._iconBottomClip);
        else
            this._iconBox.remove_clip();
    },

    stopAnimation: function() {
        Tweener.addTween(this._spinner.actor,
                         { opacity: 0,
                           time: SPINNER_ANIMATION_TIME,
                           transition: "easeOutQuad",
                           onCompleteScope: this,
                           onComplete: function() {
                               this._spinner.actor.opacity = 255;
                               this._spinner.actor.hide();
                           }
                         });
    },

    startAnimation: function() {
        this._spinner.actor.show();
    },

    _getContentPreferredWidth: function(actor, forHeight, alloc) {
        let [minSize, naturalSize] = this._iconBox.get_preferred_width(forHeight);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
        [minSize, naturalSize] = this._label.get_preferred_width(forHeight);
//        alloc.min_size = alloc.min_size + Math.max(0, minSize - Math.floor(alloc.min_size / 2));
        alloc.min_size = alloc.min_size + Math.max(0, minSize);
//        alloc.natural_size = alloc.natural_size + Math.max(0, naturalSize - Math.floor(alloc.natural_size / 2));
        alloc.natural_size = 150; // FIX ME --> This was set to 75 originally, we need some calculation.. we want this to be as big as possible for the window list to take all available space
    },

    _getContentPreferredHeight: function(actor, forWidth, alloc) {
        let [minSize, naturalSize] = this._iconBox.get_preferred_height(forWidth);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
        [minSize, naturalSize] = this._label.get_preferred_height(forWidth);
        if (minSize > alloc.min_size)
            alloc.min_size = minSize;
        if (naturalSize > alloc.natural_size)
            alloc.natural_size = naturalSize;
    },

    _contentAllocate: function(actor, box, flags) {
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;
        let childBox = new Clutter.ActorBox();

        let [minWidth, minHeight, naturalWidth, naturalHeight] = this._iconBox.get_preferred_size();

        let direction = this.actor.get_direction();

        let yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);
        if (direction == St.TextDirection.LTR) {
            childBox.x1 = 3;
            childBox.x2 = childBox.x1 + Math.min(naturalWidth, allocWidth);
        } else {
            childBox.x1 = Math.max(0, allocWidth - naturalWidth);
            childBox.x2 = allocWidth;
        }
        this._iconBox.allocate(childBox, flags);

        let iconWidth = 16;

        [minWidth, minHeight, naturalWidth, naturalHeight] = this._label.get_preferred_size();

        yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);

        if (direction == St.TextDirection.LTR) {
            childBox.x1 = Math.floor(iconWidth + 5);
            childBox.x2 = Math.min(childBox.x1 + naturalWidth, allocWidth);
        } else {
            childBox.x2 = allocWidth - Math.floor(iconWidth + 3);
            childBox.x1 = Math.max(0, childBox.x2 - naturalWidth);
        }
        this._label.allocate(childBox, flags);

        if (direction == St.TextDirection.LTR) {
            childBox.x1 = Math.floor(iconWidth / 2) + this._label.width;
            childBox.x2 = childBox.x1 + this._spinner.actor.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
            this._spinner.actor.allocate(childBox, flags);
        } else {
            childBox.x1 = -this._spinner.actor.width;
            childBox.x2 = childBox.x1 + this._spinner.actor.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
            this._spinner.actor.allocate(childBox, flags);
        }
    }
};

function WindowList() {
    this._init();
}

WindowList.prototype = {
//    __proto__ : WindowList.prototype,

    _init: function() {
        this.actor = new St.BoxLayout({ name: 'windowList',
                                        style_class: 'window-list-box' });
        this.actor._delegate = this;
        this._windows = new Array();
                
        let tracker = Shell.WindowTracker.get_default();
        tracker.connect('notify::focus-app', Lang.bind(this, this._onFocus));

        global.window_manager.connect('switch-workspace',
                                        Lang.bind(this, this._refreshItems));
        global.window_manager.connect('minimize',
                                        Lang.bind(this, this._onMinimize));
        global.window_manager.connect('map',
                                        Lang.bind(this, this._onMap));
        
        this._workspaces = [];
        this._changeWorkspaces();
        global.screen.connect('notify::n-workspaces',
                                Lang.bind(this, this._changeWorkspaces));
                                
//        this._container.connect('allocate', Lang.bind(Main.panel, this._allocateBoxes));
    },

    _onFocus: function() {
        for ( let i = 0; i < this._windows.length; ++i ) {
            this._windows[i].doFocus();
        }
    },
    
    _refreshItems: function() {
        this.actor.destroy_children();
        this._windows = new Array();

        let metaWorkspace = global.screen.get_active_workspace();
        let windows = metaWorkspace.list_windows();
        windows.sort(function(w1, w2) {
            return w1.get_stable_sequence() - w2.get_stable_sequence();
        });
                
        // Create list items for each window
        let tracker = Shell.WindowTracker.get_default();
        for ( let i = 0; i < windows.length; ++i ) {
            let metaWindow = windows[i];
            if ( metaWindow && tracker.is_window_interesting(metaWindow) ) {
                let app = tracker.get_window_app(metaWindow);
                if ( app ) {
                    let appbutton = new AppMenuButton(app, metaWindow, false);
                    this._windows.push(appbutton);
                    this.actor.add(appbutton.actor);
                }
            }
        }

        this._onFocus();
    },

    _onMinimize: function(shellwm, actor) {
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == actor.get_meta_window() ) {                
                this._windows[i]._label.set_text("["+ actor.get_meta_window().get_title() +"]");     
                this._windows[i].rightClickMenu.itemMinimizeWindow.label.set_text("Restore");           
                return;
            }
        }
    },
    
    _onMap: function(shellwm, actor) {
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == actor.get_meta_window() ) {                
                this._windows[i]._label.set_text(actor.get_meta_window().get_title());                
                this._windows[i].rightClickMenu.itemMinimizeWindow.label.set_text("Minimize");
                return;
            }
        }
    },
  
    _windowAdded: function(metaWorkspace, metaWindow) {
        if ( metaWorkspace.index() != global.screen.get_active_workspace_index() ) {
            return;
        }

        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == metaWindow ) {
                return;
            }
        }

        let tracker = Shell.WindowTracker.get_default();
        let app = tracker.get_window_app(metaWindow);
        if ( app && tracker.is_window_interesting(metaWindow) ) {
            let appbutton = new AppMenuButton(app, metaWindow, true);
            this._windows.push(appbutton);
            this.actor.add(appbutton.actor);
        }
    },

    _windowRemoved: function(metaWorkspace, metaWindow) {
        if ( metaWorkspace.index() != global.screen.get_active_workspace_index() ) {
            return;
        }

        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == metaWindow ) {
                this.actor.remove_actor(this._windows[i].actor);
                this._windows[i].actor.destroy();
                this._windows.splice(i, 1);
                break;
            }
        }
    },
    
    _changeWorkspaces: function() {
        for ( let i=0; i<this._workspaces.length; ++i ) {
            let ws = this._workspaces[i];
            ws.disconnect(ws._windowAddedId);
            ws.disconnect(ws._windowRemovedId);
        }

        this._workspaces = [];
        for ( let i=0; i<global.screen.n_workspaces; ++i ) {
            let ws = global.screen.get_workspace_by_index(i);
            this._workspaces[i] = ws;
            ws._windowAddedId = ws.connect('window-added',
                                    Lang.bind(this, this._windowAdded));
            ws._windowRemovedId = ws.connect('window-removed',
                                    Lang.bind(this, this._windowRemoved));
        }
    },
    
    _allocateBoxes: function(container, box, flags) {	
		let allocWidth = box.x2 - box.x1;
		let allocHeight = box.y2 - box.y1;
		let [leftMinWidth, leftNaturalWidth] = this._leftBox.get_preferred_width(-1);
		let [centerMinWidth, centerNaturalWidth] = this._centerBox.get_preferred_width(-1);
		let [rightMinWidth, rightNaturalWidth] = this._rightBox.get_preferred_width(-1);

		let sideWidth, centerWidth;
		centerWidth = centerNaturalWidth;
		sideWidth = (allocWidth - centerWidth) / 2;

		let childBox = new Clutter.ActorBox();

		childBox.y1 = 0;
		childBox.y2 = allocHeight;
		if (this.actor.get_direction() == St.TextDirection.RTL) {
			childBox.x1 = allocWidth - Math.min(allocWidth - rightNaturalWidth,
												leftNaturalWidth);
			childBox.x2 = allocWidth;
		} else {
			childBox.x1 = 0;
			childBox.x2 = Math.min(allocWidth - rightNaturalWidth, leftNaturalWidth);
		}
		this._leftBox.allocate(childBox, flags);

		childBox.x1 = Math.ceil(sideWidth);
		childBox.y1 = 0;
		childBox.x2 = childBox.x1 + centerWidth;
		childBox.y2 = allocHeight;
		this._centerBox.allocate(childBox, flags);

		childBox.y1 = 0;
		childBox.y2 = allocHeight;
		if (this.actor.get_direction() == St.TextDirection.RTL) {
			childBox.x1 = 0;
			childBox.x2 = Math.min(Math.floor(sideWidth),
								   rightNaturalWidth);
		} else {
			childBox.x1 = allocWidth - Math.min(Math.floor(sideWidth),
												rightNaturalWidth);
			childBox.x2 = allocWidth;
		}
		this._rightBox.allocate(childBox, flags);
    },
     
    setBottomPosition: function(value){
        bottomPosition = value;
        this._refreshItems();
    }
};

function ShowDesktopButton() {
    this._init();
}

ShowDesktopButton.prototype = {
//    __proto__ : ShowDesktopButton.prototype,

    _init: function() {
        this.actor = new St.Button();
        let icon = new St.Icon({icon_name: "desktop", icon_size: 24, icon_type: St.IconType.FULLCOLOR});             
        this.actor.add_actor(icon);
        
        this.actor.connect("clicked", Lang.bind(this, this._toggleShowDesktop));
        
        this._tracker = Shell.WindowTracker.get_default();
        
        this._desktopShown = false;
        
        this._alreadyMinimizedWindows = [];
    },
      
    _toggleShowDesktop: function() {
        let metaWorkspace = global.screen.get_active_workspace();
        let windows = metaWorkspace.list_windows();
        
        if (this._desktopShown) {
            for ( let i = 0; i < windows.length; ++i ) {
                if (this._tracker.is_window_interesting(windows[i])){                   
                    let shouldrestore = true;
                    for (let j = 0; j < this._alreadyMinimizedWindows.length; j++) {
                        if (windows[i] == this._alreadyMinimizedWindows[j]) {
                            shouldrestore = false;
                            break;
                        }                        
                    }    
                    if (shouldrestore) {
                        windows[i].unminimize();                                  
                    }
                }
            }
            this._alreadyMinimizedWindows.length = []; //Apparently this is better than this._alreadyMinimizedWindows = [];
        }
        else {
            for ( let i = 0; i < windows.length; ++i ) {
                if (this._tracker.is_window_interesting(windows[i])){                   
                    if (!windows[i].minimized) {
                        windows[i].minimize();
                    }
                    else {
                        this._alreadyMinimizedWindows.push(windows[i]);
                    }                    
                }
            }
        }
        this._desktopShown = !this._desktopShown;
    }
};

let windowList;
let button;
let bottomPosition;
let appMenu;

function init(extensionMeta) {
    // Find out if the bottom panel extension is enabled    
    let settings = new Gio.Settings({ schema: 'org.gnome.shell' });
    let enabled_extensions = settings.get_strv('enabled-extensions');
    if (enabled_extensions.indexOf("bottompanel@linuxdeepin.com") != -1) {
        bottomPosition = true;
    }
    else {
        bottomPosition = false;
    }    
    imports.gettext.bindtextdomain('gnome-shell-extensions', extensionMeta.localedir);        
    windowList = new WindowList();
    button = new ShowDesktopButton();
    appMenu = Main.panel._appMenu;   
}

function enable() {	
                
    // Create a show desktop button   
    Main.panel._leftBox.add(button.actor, { x_fill: true, y_fill: true });
    
    /* Create a Window List */ 
    Main.panel._leftBox.add(windowList.actor, { x_fill: true, y_fill: true });
    
    /* Tell the main panel we're here */
    Main.panel._deepinWindowList = windowList;
    Main.panel._deepinShowDesktopButton = button;
    
    /* Look for deepinPanel */
    if (Main.panel._deepinPanel != null) {
        global.log("deepinWindowList found deepinPanel");
        Main.panel._deepinPanel.moveMe(button);
        Main.panel._deepinPanel.moveMe(windowList);
    }
    
    if (!bottomPosition) {                        
        /* Remove Application Menu */  
        Main.panel._leftBox.remove_actor(appMenu.actor);          
    }
}

function disable() {            
    // Remove the show desktop button   
    Main.panel._leftBox.remove_actor(button.actor);
    
    // Remove the window list
    Main.panel._leftBox.remove_actor(windowList.actor);
    
    if (!bottomPosition) {
        // Place back the Application Menu
        Main.panel._leftBox.insert_actor(appMenu.actor, 1);
    }
    if (Main.panel._deepinPanel != null) {
        try {
            Main.panel._deepinPanel.leftBox.remove_actor(button.actor); 
            Main.panel._deepinPanel.leftBox.remove_actor(windowList.actor);                  
        }
        catch(err) {
            // Best effort, user could have disabled/enabled the bottom panel, so we don't really know where to remove ourselves from.
        }
    }
}
