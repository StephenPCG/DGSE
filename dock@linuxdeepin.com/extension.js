/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Shell = imports.gi.Shell;
const Lang = imports.lang;
const Signals = imports.signals;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Params = imports.misc.params;

const AppFavorites = imports.ui.appFavorites;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const Overview = imports.ui.overview;
const Extension = imports.ui.extensionSystem.extensions['dock@linuxdeepin.com'];
const PopupMenu = Extension.popupMenu;
const Search = imports.ui.search;
const Tweener = imports.ui.tweener;
const Workspace = imports.ui.workspace;
const AppDisplay = imports.ui.appDisplay;
const AltTab = imports.ui.altTab;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const THUMBNAIL_DEFAULT_SIZE = 150;

//hide
let dockIconSize;
let dockFrameWidth;
let dockFrameHeight;
let dockFramePaddingX;
let dockFramePaddingY;
let dockIconPaddingY;
let activitiesButtonWidth;
let appMenu;
let dock;

function Dock() {
    this._init();
}

Dock.prototype = {
    _init : function() {
        this._menus = [];
        this._menuDisplays = [];

        this._favorites = [];

        // Load Settings
        this._spacing = 4;
        this._nicons = 0;

        this._grid = new Shell.GenericContainer();

        this._grid.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this._grid.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this._grid.connect('allocate', Lang.bind(this, this._allocate));

        this._workId = Main.initializeDeferredWork(this._grid, Lang.bind(this, this._redisplay));

        this._tracker = Shell.WindowTracker.get_default();
        this._appSystem = Shell.AppSystem.get_default();

        this._installedChangedId = this._appSystem.connect('installed-changed', Lang.bind(this, this._queueRedisplay));
        this._appFavoritesChangedId = AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._queueRedisplay));
        this._appStateChangedId = this._appSystem.connect('app-state-changed', Lang.bind(this, this._queueRedisplay));

        this._showDock();
    },

    _showDock: function() {
        let monitor = Main.layoutManager.primaryMonitor;
        let x = monitor.x + activitiesButtonWidth;
        let y = 0;
        let width = this._nicons * (dockFrameWidth + dockFramePaddingX) + dockFramePaddingX;
        let height = dockFrameHeight + dockFramePaddingY * 2;

        this._grid.set_position(x, y);
        this._grid.set_size(width, height);
    },

    destroy: function() {
        if (this._installedChangedId) {
            this._appSystem.disconnect(this._installedChangedId);
            this._installedChangedId = 0;
        }

        if (this._appFavoritesChangedId) {
            AppFavorites.getAppFavorites().disconnect(this._appFavoritesChangedId);
            this._appFavoritesChangedId = 0;
        }

        if (this._appStateChangedId) {
            this._appSystem.disconnect(this._appStateChangedId);
            this._appStateChangedId = 0;
        }

        if (this._overviewShowingId) {
            Main.overview.disconnect(this._overviewShowingId);
            this._overviewShowingId = 0;
        }

        if (this._overviewHiddenId) {
            Main.overview.disconnect(this._overviewHiddenId);
            this._overviewHiddenId = 0;
        }

        this._grid.destroy();

        // Break reference cycles
        this._appSystem = null;
        this._tracker = null;
    },

    _appIdListToHash: function(apps) {
        let ids = {};
        for (let i = 0; i < apps.length; i++)
            ids[apps[i].get_id()] = apps[i];
        return ids;
    },

    _queueRedisplay: function () {
        Main.queueDeferredWork(this._workId);
    },

    _redisplay: function () {
        this.removeAll();

        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        let running = this._appSystem.get_running();
        let runningIds = this._appIdListToHash(running);

        let icons = 0;

        let nFavorites = 0;
        for (let id in favorites) {
            let app = favorites[id];
            let display = new DockIcon(app,this);
            this.addItem(display.actor);
            nFavorites++;
            icons++;
        }

        for (let i = 0; i < running.length; i++) {
            let app = running[i];
            if (app.get_id() in favorites)
                continue;
            let display = new DockIcon(app,this);
            icons++;
            this.addItem(display.actor);
        }
        this._nicons=icons;

        this._showDock();
    },

    _getPreferredWidth: function (grid, forHeight, alloc) {
        let nRows = this._grid.get_children().length;
        let dockbarWidth = nRows * (dockFrameWidth + dockFramePaddingX) + dockFramePaddingX;
        alloc.min_size = dockbarWidth;
        alloc.natural_size = dockbarWidth;
    },

    _getPreferredHeight: function (grid, forWidth, alloc) {
        let dockbarHeight = dockFrameHeight + 2 * dockFramePaddingY;
        alloc.min_size = dockbarHeight;
        alloc.natural_size = dockbarHeight;
    },

    _allocate: function (grid, box, flags) {
        let children = this._grid.get_children();

        let x = box.x1 + dockFramePaddingX;
        let y = box.y1 + dockFramePaddingY;

        for (let i = 0; i < children.length; i++) {
            let childBox = new Clutter.ActorBox();
            childBox.x1 = x;
            childBox.y1 = y;
            childBox.x2 = childBox.x1 + dockFrameWidth;
            childBox.y2 = childBox.y1 + dockFrameHeight;
            children[i].allocate(childBox, flags);
            x += dockFrameWidth + dockFramePaddingX;
        }
    },

    removeAll: function () {
        this._grid.get_children().forEach(Lang.bind(this, function (child) {
                                                        child.destroy();
                                                    }));
    },

    addItem: function(actor) {
        this._grid.add_actor(actor);
    }
};
Signals.addSignalMethods(Dock.prototype);

function DockIcon(app, dock) {
    this._init(app, dock);
}

DockIcon.prototype = {
    _init : function(app, dock) {
        this.app = app;
        this.actor = new St.Button({ style_class: 'dock-app',
                                     button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO,
                                     reactive: true,
                                     can_focus: true,
                                     x_fill: false,
                                     y_fill: false,
                                     track_hover: true});
        this.actor._delegate = this;
        this.actor.set_size(dockFrameWidth, dockFrameHeight);

        this._icon = this.app.create_icon_texture(dockIconSize);
        this.actor.set_child(this._icon);

        this.actor.connect('clicked', Lang.bind(this, this._onClicked));

        this._menu = null;
        this._menuManager = new PopupMenu.PopupMenuManager(this);

        this._has_focus = false;

        let tracker = Shell.WindowTracker.get_default();
        tracker.connect('notify::focus-app', Lang.bind(this, this._onStateChanged));

        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
        this.actor.connect('notify::hover', Lang.bind(this, this._hoverChanged));

        this._menuTimeoutId = 0;
        this._stateChangedId = this.app.connect('notify::state',
                                                Lang.bind(this, this._onStateChanged));
        this._onStateChanged();
        this._dock=dock;

        this.hasHoverMenu = false;
    },

    enableHoverMenu: function() {
        this.hasHoverMenu = true;
    },

    disableHoverMenu: function() {
        this.hasHoverMenu = false;
    },

    _onDestroy: function() {
        if (this._stateChangedId > 0)
            this.app.disconnect(this._stateChangedId);
        this._stateChangedId = 0;
        this._removeMenuTimeout();
    },

    _removeMenuTimeout: function() {
        if (this._menuTimeoutId > 0) {
            Mainloop.source_remove(this._menuTimeoutId);
            this._menuTimeoutId = 0;
        }
    },

    _hoverChanged: function(actor) {
        global.log("hover");

        if (actor != this.actor)
            this._has_focus = false;
        else
            this._has_focus = true;

        let windows = this.app.get_windows();
        if (windows.length >= 1 && !this.hasHoverMenu) {
            global.log(this._has_focus);
            let thumbnailMenu = new AppThumbnailHoverMenu(this, this.actor, windows[0], this.app);
            new HoverMenuController(this.actor, thumbnailMenu, this.disableHoverMenu);

            global.log("Got it");

            this.enableHoverMenu();
        }

        return false;
    },

    _onStateChanged: function() {
        let tracker = Shell.WindowTracker.get_default();
        let focusedApp = tracker.focus_app;
        if (this.app.state != Shell.AppState.STOPPED) {
            this.actor.add_style_class_name('running');
            if (this.app == focusedApp) {
                this.actor.add_style_class_name('focused');
            } else {
                this.actor.remove_style_class_name('focused');
            }
        } else {
            this.actor.remove_style_class_name('focused');
            this.actor.remove_style_class_name('running');
        }
    },

    _onButtonPress: function(actor, event) {
        let button = event.get_button();
        if (button == 1) {
            this._removeMenuTimeout();
            this._menuTimeoutId = Mainloop.timeout_add(AppDisplay.MENU_POPUP_TIMEOUT, Lang.bind(this, function() {
                                                                                                    this.popupMenu();
                                                                                                }));
        } else if (button == 3) {
            this.popupMenu();
        }
    },

    _onClicked: function(actor, button) {
        this._removeMenuTimeout();

        if (button == 1) {
            this._onActivate(Clutter.get_current_event());
        } else if (button == 2) {
            // Last workspace is always empty
            let launchWorkspace = global.screen.get_workspace_by_index(global.screen.n_workspaces - 1);
            launchWorkspace.activate(global.get_current_time());
            this.emit('launching');
            this.app.open_new_window(-1);
        }
        return false;
    },

    getId: function() {
        return this.app.get_id();
    },

    popupMenu: function() {
        this._removeMenuTimeout();
        this.actor.fake_release();

        if (!this._menu) {
            this._menu = new DockIconMenu(this);
            this._menu.connect('activate-window', Lang.bind(this, function (menu, window) {
                                                                this.activateWindow(window);
                                                            }));
            this._menu.connect('open-state-changed', Lang.bind(this, function (menu, isPoppedUp) {
                                                                   if (!isPoppedUp){
                                                                       this._onMenuPoppedDown();
                                                                   }
                                                               }));

            this._menuManager.addMenu(this._menu, true);
        }

        this._menu.popup();

        return false;
    },

    activateWindow: function(metaWindow) {
        if (metaWindow) {
            this._didActivateWindow = true;
            Main.activateWindow(metaWindow);
        }
    },

    setSelected: function (isSelected) {
        this._selected = isSelected;
        if (this._selected)
            this.actor.add_style_class_name('selected');
        else
            this.actor.remove_style_class_name('selected');
    },

    _onMenuPoppedDown: function() {
        this.actor.sync_hover();
    },

    _getRunning: function() {
        return this.app.state != Shell.AppState.STOPPED;
    },

    _onActivate: function (event) {
        this.emit('launching');
        let modifiers = Shell.get_event_state(event);

        if (modifiers & Clutter.ModifierType.CONTROL_MASK
            && this.app.state == Shell.AppState.RUNNING) {
            let current_workspace = global.screen.get_active_workspace().index();
            this.app.open_new_window(current_workspace);
        } else {
            let tracker = Shell.WindowTracker.get_default();
            let focusedApp = tracker.focus_app;

            if (this.app == focusedApp) {
                let windows = this.app.get_windows();
                let current_workspace = global.screen.get_active_workspace();
                for (let i = 0; i < windows.length; i++) {
                    let w = windows[i];
                    if (w.get_workspace() == current_workspace)
                        w.minimize();
                }
            } else {
                this.app.activate(-1);
            }
        }
        Main.overview.hide();
    },

    shellWorkspaceLaunch : function() {
        this.app.open_new_window();
    }
};
Signals.addSignalMethods(DockIcon.prototype);

function DockThumbnail(app, window, width, height) {
    this._init(app, window, width, height);
}

DockThumbnail.prototype = {
    _init : function(app, window, width, height) {
        this.app = app;
        this.window = window;

        this.highlighted = false;

        this.actor = new St.Button({style_class: 'dock-thumbnail-icon',
                                    reactive: true,
                                    can_focus: true});

        this.actorBox = new St.BoxLayout({vertical: true,
                                          can_focus: true});
        this.actor.set_child(this.actorBox);

        this.icon = null;
        this._iconBin = new St.Bin({ x_fill: true, y_fill: true });
        this.iconWidth = width;
        this.iconHeight = height;
        this.set_size(this.iconWidth, this.iconHeight);

        this.actorBox.add(this._iconBin, { x_fill: true, y_fill: true } );

        let title = window.get_title();
        let labelText;
        if (!title) {
            title = this.app.get_name();
        }
        this.label = new St.Label(
            {style_class: 'dock-thumbnail-icon-font',
             text: title });
        let bin = new St.Bin({x_align: St.Align.MIDDLE});
        bin.add_actor(this.label);
        bin.set_width(width);
        this.actorBox.add(bin);
    },

    select: function() {
        if (!this.highlighted) {
            this.actor.add_style_pseudo_class('windowSelected');
            this.highlighted = true;
        }
    },

    unselect: function() {
        if (this.highlighted) {
            this.actor.remove_style_pseudo_class('windowSelected');
            this.highlighted = false;
        }
    },

    set_size: function(iconWidth, iconHeight) {
        let clone = null;

        let mutterWindow = this.window.get_compositor_private();
        let windowTexture = mutterWindow.get_texture ();
        let [width, height] = windowTexture.get_size();
        let scale = Math.min(1.0, iconWidth / width, iconHeight / height);

        clone = new Clutter.Group({clip_to_allocation: true});
        clone.set_size(this.iconWidth, this.iconHeight);

        let windowClone = new Clutter.Clone (
            { source: windowTexture,
              reactive: true,
              x: (this.iconWidth - (width * scale)) / 2,
              y: (this.iconHeight - (height * scale)) / 2,
              width: width * scale,
              height: height * scale
            });
        clone.add_actor(windowClone);

        this.icon = this.app.create_icon_texture(iconWidth);
        this._iconBin.set_size(iconWidth, iconHeight);

        this._iconBin.child = clone;
    }
};
Signals.addSignalMethods(DockThumbnail.prototype);

function DockIconMenu(source) {
    this._init(source);
}

DockIconMenu.prototype = {
    __proto__: AppDisplay.AppIconMenu.prototype,

    _init: function(source) {
        PopupMenu.PopupMenu.prototype._init.call(this, source.actor, 0.5, St.Side.TOP, 0);

        this._source = source;

        this.connect('activate', Lang.bind(this, this._onActivate));

        this.actor.add_style_class_name('dock-menu');

        // Chain our visibility and lifecycle to that of the source
        source.actor.connect('notify::mapped', Lang.bind(this, function () {
                                                             if (!source.actor.mapped)
                                                                 this.close();
                                                         }));
        source.actor.connect('destroy', Lang.bind(this, function () { this.actor.destroy(); }));

        Main.layoutManager.addChrome(this.actor);
    },

    _redisplay: function() {
        this.removeAll();

        let windows = this._source.app.get_windows();

        // Display the app windows menu items and the separator between windows
        // of the current desktop and other windows.
        let activeWorkspace = global.screen.get_active_workspace();
        let separatorShown = windows.length > 0 && windows[0].get_workspace() != activeWorkspace;

        for (let i = 0; i < windows.length; i++) {
            if (!separatorShown && windows[i].get_workspace() != activeWorkspace) {
                this._appendSeparator();
                separatorShown = true;
            }
            let item = this._appendMenuItem(windows[i].title);
            item._window = windows[i];
        }

        if (windows.length > 0)
            this._appendSeparator();

        let isFavorite = AppFavorites.getAppFavorites().isFavorite(this._source.app.get_id());

        this._newWindowMenuItem = windows.length > 0 ? this._appendMenuItem(_("New Window")) : null;

        this._quitAppMenuItem = windows.length >0 ? this._appendMenuItem(_("Quit Application")) : null;

        if (windows.length > 0)
            this._appendSeparator();
        this._toggleFavoriteMenuItem = this._appendMenuItem(isFavorite ?
                                                            _("Remove from Favorites")
                                                            : _("Add to Favorites"));

        this._highlightedItem = null;
    },

    _onActivate: function (actor, child) {
        if (child._window) {
            let metaWindow = child._window;
            this.emit('activate-window', metaWindow);
        } else if (child == this._newWindowMenuItem) {
            let current_workspace = global.screen.get_active_workspace().index();
            this._source.app.open_new_window(current_workspace);
            this.emit('activate-window', null);
        } else if (child == this._quitAppMenuItem) {
            this._source.app.request_quit();
        } else if (child == this._toggleFavoriteMenuItem) {
            let favs = AppFavorites.getAppFavorites();
            let isFavorite = favs.isFavorite(this._source.app.get_id());
            if (isFavorite)
                favs.removeFavorite(this._source.app.get_id());
            else
                favs.addFavorite(this._source.app.get_id());
        }
        this.close();
    }
};

function HoverMenuController() {
    this._init.apply(this, arguments);
}

HoverMenuController.prototype = {
    _init: function(actor, menu, params, closeCallback) {
        // reactive: should the menu stay open if your mouse is above the menu
        // clickShouldImpede: if you click actor, should the menu be prevented from opening
        // clickShouldClose: if you click actor, should the menu close
        params = Params.parse(params, { reactive: true,
                                        clickShouldImpede: true,
                                        clickShouldClose: true });

        this._parentActor = actor;
        this._parentMenu = menu;
        this.closeCallback = closeCallback;

        this._parentActor.reactive = true;
        this._parentActor.connect('enter-event', Lang.bind(this, this._onEnter));
        this._parentActor.connect('leave-event', Lang.bind(this, this._onLeave));

        // If we're reactive, it means that we can move our mouse to the popup
        // menu and interact with it.  It shouldn't close while we're interacting
        // with it.
        if (params.reactive) {
            this._parentMenu.actor.connect('enter-event', Lang.bind(this, this._onParentMenuEnter));
            this._parentMenu.actor.connect('leave-event', Lang.bind(this, this._onParentMenuLeave));
        }

        if (params.clickShouldImpede || params.clickShouldClose) {
            this.clickShouldImpede = params.clickShouldImpede;
            this.clickShouldClose = params.clickShouldClose;
            this._parentActor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        }
    },

    _onButtonPress: function() {
        if (this.clickShouldImpede) {
            this.shouldOpen = false;
        }
        if (this.clickShouldClose) {
            if (!this.impedeClose) {
                this.shouldClose = true;
            }
            this.close();
        }
    },

    _onParentMenuEnter: function() {
        this.shouldClose = false;
    },

    _onParentMenuLeave: function() {
        this.shouldClose = true;

        this.close();
    },

    _onEnter: function() {
        if (!this.impedeOpen) {
            this.shouldOpen = true;
        }
        this.shouldClose = false;

        this.open();
    },

    _onLeave: function() {
        if (!this.impedeClose) {
            this.shouldClose = true;
        }
        this.shouldOpen = false;

        this.close();
    },

    open: function() {
        if (this.shouldOpen && !this._parentMenu.isOpen) {
            this._parentMenu.open(true);
        }
    },

    close: function() {
        if (this.shouldClose) {
            this._parentMenu.close(true);
            this.closeCallback();
        }
    },

    enable: function() {
        this.impedeOpen = false;
    },

    disable: function() {
        this.impedeOpen = true;
    }
};

function HoverMenu() {
    this._init.apply(this, arguments);
}

HoverMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(actor, params) {
        PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.5, St.Side.TOP);

        params = Params.parse(params, { reactive: true });

        this._parentActor = actor;

        this.actor.hide();

        if (params.reactive) {
            Main.layoutManager.addChrome(this.actor);
        } else {
            Main.uiGroup.add_actor(this.actor);
        }
    }
};

function AppThumbnailHoverMenu() {
    this._init.apply(this, arguments);
}

AppThumbnailHoverMenu.prototype = {
    __proto__: HoverMenu.prototype,

    _init: function(source, actor, metaWindow, app) {
        HoverMenu.prototype._init.call(this, actor, { reactive: true });

        this.source = source;
        this.metaWindow = metaWindow;
        this.app = app;

        this.appSwitcherItem = new PopupMenuAppSwitcherItem(this, source, this.metaWindow, this.app);
        this.addMenuItem(this.appSwitcherItem);
    },

    open: function(animate) {
        this.appSwitcherItem._refresh();
        PopupMenu.PopupMenu.prototype.open.call(this);
    }


};

// display a list of app thumbnails and allow
// bringing any app to focus by clicking on its thumbnail
function PopupMenuAppSwitcherItem() {
    this._init.apply(this, arguments);
}

PopupMenuAppSwitcherItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (menu, source, metaWindow, app, params) {
        params = Params.parse(params, { hover: false });
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

		
        let primary = Main.layoutManager.primaryMonitor;
        this.monitorWidth = primary.width;
        this.monitorHeight = primary.height;
        this.windowWidth = this.monitorWidth * 3 / 4;
        this.thumbnailBorder = 1;
        this.thumbnailPaddingX = 10;
        this.thumbnailPaddingY = 10;
        this.thumbnailFontSize = 15;
        this.windowPaddingX = 10;
        this.windowPaddingUp = 10;
        this.windowPaddingBottom = 20;
        this.thumbnailColumns = 4;
        this.thumbnailRows = 4;
        this.thumbnailWidth = (this.windowWidth - (this.thumbnailColumns * (this.thumbnailPaddingX + this.thumbnailBorder) * 2) - this.windowPaddingX * 2) / this.thumbnailColumns;
        this.thumbnailHeight = this.thumbnailWidth * (this.monitorHeight / this.monitorWidth);
		
        this.menu = menu;
        this.source = source;
        this.app = app;

        this.appContainer = new St.Table();
		
        this.addActor(this.appContainer);
    },

    _connectToWindowOpen: function(actor, metaWindow) {
        actor.connect('button-release-event', Lang.bind(this, function() {
                                                            metaWindow.activate(global.get_current_time());
                                                        }));
    },

    _refresh: function() {
        this.appContainer.get_children().forEach(Lang.bind(this, function (child) {
                                                               child.destroy();
                                                           }));
		
        let windows = this.app.get_windows();
		let maxWidth = 0;
		let thumbnailNum = windows.length;
		
		for (let j = 0; j < windows.length; j++) {
			let [winWidth, winHeight] = windows[j].get_compositor_private().get_texture().get_size();
			if (winWidth > maxWidth) {
				maxWidth = winWidth;
			}
		}
		
		this.requestWidth = this.thumbnailWidth / this.monitorWidth * maxWidth;
		this.requestHeight = this.thumbnailHeight;
				
		
        let childBox = new Clutter.ActorBox();
        let rows = Math.floor(thumbnailNum / this.thumbnailColumns) + (thumbnailNum % this.thumbnailColumns ? 1 : 0);
        let windowWidth = 0;
        if (thumbnailNum > this.thumbnailColumns) {
            windowWidth = this.thumbnailColumns * this.requestWidth + this.thumbnailColumns * (this.thumbnailPaddingX + this.thumbnailBorder) * 2 + this.windowPaddingX * 2;
        } else {
            windowWidth = thumbnailNum * this.requestWidth + thumbnailNum * (this.thumbnailPaddingX + this.thumbnailBorder) * 2 + this.windowPaddingX * 2;
        }
        let windowHeight = rows * this.requestHeight + rows * (this.thumbnailPaddingY + this.thumbnailBorder) * 2 + rows * this.thumbnailFontSize + this.windowPaddingUp + this.windowPaddingBottom;
		let [iconX, iconY] = this.source.actor.get_transformed_position();
		let windowOffsetX = iconX + windowWidth / 2;
		let windowOffsetY = iconY;
		this.menu.box.set_position(windowOffsetX, windowOffsetY);
		this.menu.box.set_size(windowWidth, windowHeight);

        for (let i = 0; i < windows.length; i++) {
            let index = i;
            let iconRow = Math.floor(index / this.thumbnailColumns);
            let iconColumn = index % this.thumbnailColumns;
            let windowThumbnail = new DockThumbnail(
				this.app, 
				windows[i], 
				this.requestWidth,
				this.requestHeight);
            this.appContainer.add(windowThumbnail.actor,
								  {row: iconRow,
								   col: iconColumn
								  });
            this._connectToWindowOpen(windowThumbnail.actor, windows[i]);
		}
    }
};

function init(extensionMeta) {
    imports.gettext.bindtextdomain('gnome-shell-extensions', extensionMeta.localedir);
    appMenu = Main.panel._appMenu;
    activitiesButtonWidth = Main.panel._activitiesButton.actor.get_width();
    dockFramePaddingX = 2;
    dockFramePaddingY = 1;
    dockIconPaddingY = 1;
    dockFrameHeight = Math.floor(Main.panel.actor.get_height() - 2 * dockFramePaddingY) - 1; // panel border is 1, so adjust 1
    dockFrameWidth = Math.floor(dockFrameHeight * 4 / 3);
    dockIconSize = dockFrameHeight - 2 * dockIconPaddingY;
}


function enable() {
    // Remove application menu.
    Main.panel._leftBox.remove_actor(appMenu.actor);

    // Add dock.
    dock = new Dock();
    Main.panel._leftBox.add(dock._grid, {x_fill: true, y_fill: true});
}

function disable() {
    // Remove dock.
    dock.destroy();
    dock = null;

    // Restore application menu.
    Main.panel._leftBox.insert_actor(appMenu.actor, 1);
}
