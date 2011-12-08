const AltTab = imports.ui.altTab;
const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;
const ModalDialog = imports.ui.modalDialog;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;
const WindowManager = imports.ui.windowManager;

const POPUP_FADE_TIME = 0.0; // seconds


function AltTabPopupW() {
    this._init();
}

AltTabPopupW.prototype = {
    __proto__ : AltTab.AltTabPopup.prototype,

    show : function(backward, switch_group) {
        let appSys = Shell.AppSystem.get_default();
        let apps = appSys.get_running ();

        if (!apps.length)
            return false;

        if (!Main.pushModal(this.actor))
            return false;
        this._haveModal = true;

        this.actor.connect('key-press-event', Lang.bind(this, this._keyPressEvent));
        this.actor.connect('key-release-event', Lang.bind(this, this._keyReleaseEvent));

        this.actor.connect('button-press-event', Lang.bind(this, this._clickedOutside));
        this.actor.connect('scroll-event', Lang.bind(this, this._onScroll));

        this._appSwitcher = new WindowSwitcher(apps, this);
        this.actor.add_actor(this._appSwitcher.actor);
        this._appSwitcher.connect('item-activated', Lang.bind(this, this._appActivated));
        this._appSwitcher.connect('item-entered', Lang.bind(this, this._appEntered));

        this._appIcons = this._appSwitcher.icons;

        // Make the initial selection
        if (switch_group) {
            if (backward) {
                this._select(0, this._appIcons[0].cachedWindows.length - 1);
            } else {
                if (this._appIcons[0].cachedWindows.length > 1)
                    this._select(0, 1);
                else
                    this._select(0, 0);
            }
        } else if (this._appIcons.length == 1) {
            this._select(0);
        } else if (backward) {
            this._select(this._appIcons.length - 1);
        } else {
            this._select(1);
        }

        let [x, y, mods] = global.get_pointer();
        if (!(mods & Gdk.ModifierType.MOD1_MASK)) {
            this._finish();
            return false;
        }

        this.actor.opacity = 0;
        this.actor.show();
        Tweener.addTween(this.actor,
                         { opacity: 255,
                           time: POPUP_FADE_TIME,
                           transition: 'easeOutQuad'
                         });
        return true;
    },
    
    
    _keyPressEvent : function(actor, event) {
        let keysym = event.get_key_symbol();
        let event_state = Shell.get_event_state(event);
        let backwards = event_state & Clutter.ModifierType.SHIFT_MASK;
        let action = global.display.get_keybinding_action(event.get_key_code(), event_state);

        this._disableHover();

        if(action == Meta.KeyBindingAction.WORKSPACE_LEFT) {
            this.destroy();
            this.actionMoveWorkspaceLeft();
            new AltTabPopupW().show();
        } else if(action == Meta.KeyBindingAction.WORKSPACE_RIGHT) {
            this.destroy();
            this.actionMoveWorkspaceRight();
            new AltTabPopupW().show();
        } else if(action == Meta.KeyBindingAction.WORKSPACE_DOWN) {
            this.destroy();
            this.actionMoveWorkspaceDown();
            new AltTabPopupW().show();
        } else if(action == Meta.KeyBindingAction.WORKSPACE_TOP) {
            this.destroy();
            this.actionMoveWorkspaceUp();
            new AltTabPopupW().show();
        } else if (keysym == Clutter.Escape) {
            this.destroy();
        } else if (action == Meta.KeyBindingAction.SWITCH_GROUP) {
            this._select(this._currentApp, backwards ? this._previousWindow() : this._nextWindow());
        } else if (action == Meta.KeyBindingAction.SWITCH_GROUP_BACKWARD) {
            this._select(this._currentApp, this._previousWindow());
        } else if (action == Meta.KeyBindingAction.SWITCH_WINDOWS) {
            this._select(backwards ? this._previousApp() : this._nextApp());
        } else if (action == Meta.KeyBindingAction.SWITCH_WINDOWS_BACKWARD) {
            this._select(this._previousApp());
        } else if (this._thumbnailsFocused) {
            if (keysym == Clutter.Left)
                this._select(this._currentApp, this._previousWindow());
            else if (keysym == Clutter.Right)
                this._select(this._currentApp, this._nextWindow());
            else if (keysym == Clutter.Up)
                this._select(this._currentApp, null, true);
        } else {
            if (keysym == Clutter.Left)
                this._select(this._previousApp());
            else if (keysym == Clutter.Right)
                this._select(this._nextApp());
            else if (keysym == Clutter.Down)
                this._select(this._currentApp, 0);
        }

        return true;
    },

    _keyReleaseEvent : function(actor, event) {
        let [x, y, mods] = global.get_pointer();
        if (!(mods & Gdk.ModifierType.MOD1_MASK))
            this._finish();

        return true;
    },

    _finish : function() {
        let app = this._appIcons[this._currentApp];
        Main.activateWindow(app.cachedWindows[0]);
        this.destroy();
    },

    actionMoveWorkspaceLeft: function() {
        let rtl = (St.Widget.get_default_direction() == St.TextDirection.RTL);
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let indexToActivate = activeWorkspaceIndex;
        if (rtl && activeWorkspaceIndex < global.screen.n_workspaces - 1)
            indexToActivate++;
        else if (!rtl && activeWorkspaceIndex > 0)
            indexToActivate--;

        if (indexToActivate != activeWorkspaceIndex)
            global.screen.get_workspace_by_index(indexToActivate).activate(global.get_current_time());
    },

    actionMoveWorkspaceRight: function() {
        let rtl = (St.Widget.get_default_direction() == St.TextDirection.RTL);
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let indexToActivate = activeWorkspaceIndex;
        if (rtl && activeWorkspaceIndex > 0)
            indexToActivate--;
        else if (!rtl && activeWorkspaceIndex < global.screen.n_workspaces - 1)
            indexToActivate++;

        if (indexToActivate != activeWorkspaceIndex)
            global.screen.get_workspace_by_index(indexToActivate).activate(global.get_current_time());
    },

    actionMoveWorkspaceUp: function() {
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let indexToActivate = activeWorkspaceIndex;
        if (activeWorkspaceIndex > 0)
            indexToActivate--;

        if (indexToActivate != activeWorkspaceIndex)
            global.screen.get_workspace_by_index(indexToActivate).activate(global.get_current_time());
    },

    actionMoveWorkspaceDown: function() {
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let indexToActivate = activeWorkspaceIndex;
        if (activeWorkspaceIndex < global.screen.n_workspaces - 1)
            indexToActivate++;

        if (indexToActivate != activeWorkspaceIndex)
            global.screen.get_workspace_by_index(indexToActivate).activate(global.get_current_time());
    }
};

function AppIcon(app, window, activeWorkspace) {
    this._init(app, window, activeWorkspace);
}
        
AppIcon.prototype = {
    __proto__ : AltTab.AppIcon.prototype,

    _init: function(app, window, activeWorkspace) {
        this.app = app;
		this.window = window;
		this.isWorkspace = !(window.get_workspace() == activeWorkspace);

        this.cachedWindows = [];
        this.cachedWindows.push(window);

        this.actor = new St.BoxLayout({ style_class: 'alt-tab-app',
                                         vertical: true });
        this.icon = null;
        this._iconBin = new St.Bin({ x_fill: true, y_fill: false });
		let primary = Main.layoutManager.primaryMonitor;
		this.iconWidth = 220;
		this.iconHeight = this.iconWidth * (primary.height / primary.width);
		this.set_size(this.iconWidth, this.iconHeight);

        this.actor.add(this._iconBin, { x_fill: false, y_fill: false } );

        let title = window.get_title();
		if (this.isWorkspace) {
		    this.label = new St.Label({text: "Workspace " + (window.get_workspace().index() + 1)});
            this.actor.add(this.label, { x_fill: false });
		} else if (title) {
            this.label = new St.Label({ text: title });
            let bin = new St.Bin({ x_align: St.Align.MIDDLE });
            bin.add_actor(this.label);
            this.actor.add(bin);
        } else {
            this.label = new St.Label({ text: this.app.get_name() });
            this.actor.add(this.label, { x_fill: false });
        }
    },

	get_workspace_clone: function(workspaceIndex) {
		// Get monitor size and scale value.
        let monitor = Main.layoutManager.primaryMonitor;
		let scaleX = this.iconWidth / monitor.width;
		let scaleY = this.iconHeight / monitor.height;
		
		// Create actor group.
	   	let clone = new Clutter.Group({clip_to_allocation: true});
		clone.set_size(monitor.width, monitor.height);
		
		// Add background.
		let background = Meta.BackgroundActor.new_for_screen(global.screen);			
		background.set_scale(scaleX, scaleY);
		clone.add_actor(background);
		
		// Add panel.
		let [panelWidth, panelHeight] = Main.panel.actor.get_size();
		let panel = new Clutter.Clone(
			{source: Main.panel.actor,
			 reactive: true,
			 x: 0,
			 y: 0,
			 width: panelWidth * scaleX,
			 height: panelHeight * scaleY
			}
		);
		clone.add_actor(panel);
		
		// Scale workspace windows.
		let apps = Shell.AppSystem.get_default().get_running();
		let workspaceWindows = [];
		for (let i = 0; i < apps.length; i++) {
			let windows = apps[i].get_windows();
			for (let j = 0; j < windows.length; j++) {
        		if (windows[j].get_workspace().index() == workspaceIndex) {
					workspaceWindows.push(windows[j]);
				}
			}
		}
		
		// Sort workspace windows.
        workspaceWindows.sort(Lang.bind(this, this._sortWindow));
		
		// Add workspace windows.
		for (let ii = 0; ii < workspaceWindows.length; ii++) {
			let windowTexture = workspaceWindows[ii].get_compositor_private().get_texture();
			let rect = workspaceWindows[ii].get_outer_rect();
			let windowClone = new Clutter.Clone(
			    {source: windowTexture,
			     reactive: true,
				 x: rect.x * scaleX,
				 y: rect.y * scaleY,
			     width: rect.width * scaleX,
			     height: rect.height * scaleY
			    });
			        
			clone.add_actor(windowClone);
		}

		return clone;
	},
	
    _sortWindow : function(window1, window2) {
        let t1 = window1.get_user_time();
        let t2 = window2.get_user_time();
        if (t2 < t1) {
			return 1;
		} else {
			return -1;
		}
    },
	
    set_size: function(iconWidth, iconHeight) {
        let mutterWindow = this.window.get_compositor_private();
        let windowTexture = mutterWindow.get_texture ();
        let [width, height] = windowTexture.get_size();
        let scale = Math.min(1.0, iconWidth / width);
		let clone = null;
		
		if (this.isWorkspace) {
			// Show workspace thumbnail this.isWorkspace.
			clone = this.get_workspace_clone(this.window.get_workspace().index());
		} else {
			// Otherwise show application thumbnail.
			clone = new Clutter.Clone (
				{ source: windowTexture, 
				  reactive: true,  
				  width: width * scale, 
				  height: height * scale
				});
		}
		
        this.icon = this.app.create_icon_texture(iconWidth);
        this._iconBin.set_size(iconWidth, iconHeight);
		
		this._iconBin.child = clone;
		
    }
};

function WindowSwitcher(apps, altTabPopup) {
    this._init(apps, altTabPopup);
}

WindowSwitcher.prototype = {
    __proto__ : AltTab.AppSwitcher.prototype,

    _init : function(apps, altTabPopup) {
        AltTab.SwitcherList.prototype._init.call(this, true);

        let activeWorkspace = global.screen.get_active_workspace();
        let workspaceIcons = [];
		let otherWorkspaces = {};
		let workspaceIndex = null;
        for (let i = 0; i < apps.length; i++) {
            let windows = apps[i].get_windows();
            for(let j = 0; j < windows.length; j++) {
                let appIcon = new AppIcon(apps[i], windows[j], activeWorkspace);
				
				if (this._isWindowOnWorkspace(windows[j], activeWorkspace)) {
					// Add application in current workspace to list.
					workspaceIcons.push(appIcon);
				} else {
					// Add other worspace.
		            workspaceIndex = windows[j].get_workspace().index();            
					if (otherWorkspaces[workspaceIndex]) {
						let oldTime = otherWorkspaces[workspaceIndex].cachedWindows[0].get_user_time(); 
						let newTime = appIcon.cachedWindows[0].get_user_time();
						if (newTime > oldTime) {
							// Update topest application in workspace dict.
							otherWorkspaces[workspaceIndex] = appIcon;
						}
					} else {
						// Fill workspace this is first application.
						otherWorkspaces[workspaceIndex] = appIcon;
					}
				}
            }
        }

        workspaceIcons.sort(Lang.bind(this, this._sortAppIcon));
		
        this.icons = [];
        this._arrows = [];
        for (let ii = 0; ii < workspaceIcons.length; ii++) {
			this._addIcon(workspaceIcons[ii]);
		}
		
		// Sort workspace by index.
		let keys = [];
		for (k in otherWorkspaces) {
			keys.push(k);
		}
		keys.sort();
		
		for (let jj = 0; jj < keys.length; jj++) {
			this.addSeparator();
			this._addIcon(otherWorkspaces[keys[jj]]);
		}
		
        this._curApp = -1;
        this._iconSize = 0;
        this._altTabPopup = altTabPopup;
        this._mouseTimeOutId = 0;
    },

    highlight: function(index, justOutline) {
        if (this._highlighted != -1) {
            this._items[this._highlighted].remove_style_pseudo_class('outlined');
            this._items[this._highlighted].remove_style_pseudo_class('selected');
        }

        this._highlighted = index;

        if (this._highlighted != -1) {
            if (justOutline)
                this._items[this._highlighted].add_style_pseudo_class('outlined');
            else
                this._items[this._highlighted].add_style_pseudo_class('selected');
        }

        let [absItemX, absItemY] = this._items[index].get_transformed_position();
        let [result, posX, posY] = this.actor.transform_stage_point(absItemX, 0);
        let [containerWidth, containerHeight] = this.actor.get_transformed_size();
        
        if (posX + this._items[index].get_width() > containerWidth)
            this._scrollToRight();
        else if (absItemX < 0)
            this._scrollToLeft();

    },

    _isWindowOnWorkspace: function(w, workspace) {
            if (w.get_workspace() == workspace)
                return true;
        return false;
    },

    _sortAppIcon : function(appIcon1, appIcon2) {
        let t1 = appIcon1.cachedWindows[0].get_user_time();
        let t2 = appIcon2.cachedWindows[0].get_user_time();
        if (t2 > t1) return 1;
        else return -1;
    }
};

function init(metadata) {
}

function doAltTab(shellwm, binding, window, backwards) {
    new AltTabPopupW().show();
}

function enable() {
    Main.wm.setKeybindingHandler('switch_windows', doAltTab);
    Main.wm.setKeybindingHandler('switch_group', doAltTab);
    Main.wm.setKeybindingHandler('switch_windows_backward', doAltTab);
    Main.wm.setKeybindingHandler('switch_group_backward', doAltTab);
}

function disable() {
    Main.wm.setKeybindingHandler('switch_windows', Lang.bind(Main.wm, Main.wm._startAppSwitcher));
    Main.wm.setKeybindingHandler('switch_group', Lang.bind(Main.wm, Main.wm._startAppSwitcher));
    Main.wm.setKeybindingHandler('switch_windows_backward', Lang.bind(Main.wm, Main.wm._startAppSwitcher));
    Main.wm.setKeybindingHandler('switch_group_backward', Lang.bind(Main.wm, Main.wm._startAppSwitcher));
}
