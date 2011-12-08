// Copyright (C) 2011 R M Yorston
// Licence: GPLv2+

const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const AppFavorites = imports.ui.appFavorites;
const Main = imports.ui.main;

function PanelLauncher(app) {
    this._init(app);
}

PanelLauncher.prototype = {
    _init: function(app) {
        this.actor = new St.Button({ style_class: 'panel-launcher',
                                     reactive: true });
        let icon = app.create_icon_texture(24);
        this.actor.set_child(icon);
        this.actor._delegate = this;
        let text = app.get_name();
        if ( app.get_description() ) {
            text += '\n' + app.get_description();
        }
        this.actor.set_tooltip_text(text);
        this._app = app;
        this.actor.connect('clicked', Lang.bind(this, function() {
            this._app.open_new_window(-1);
        }));
    }
};

function PanelFavorites() {
    this._init();
}

PanelFavorites.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout({ name: 'panelFavorites',
                                        style_class: 'panel-favorites' });
        this._display();

        Shell.AppSystem.get_default().connect('installed-changed', Lang.bind(this, this._redisplay));
        AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._redisplay));
    },

    _redisplay: function() {
        for ( let i=0; i<this._buttons.length; ++i ) {
            this._buttons[i].actor.destroy();
        }

        this._display();
    },

    _display: function() {
        let launchers = global.settings.get_strv(AppFavorites.getAppFavorites().FAVORITE_APPS_KEY);

        this._buttons = [];
        let j = 0;
        for ( let i=0; i<launchers.length; ++i ) {
            let app = Shell.AppSystem.get_default().lookup_app(launchers[i]);

            if ( app == null ) {
                continue;
            }

            this._buttons[j] = new PanelLauncher(app);
            this.actor.add(this._buttons[j].actor);
            ++j;
        }
    },

    enable: function() {
        Main.panel._leftBox.insert_actor(this.actor, 1);
    },

    disable: function() {
        Main.panel._leftBox.remove_actor(this.actor);
    }
};

function init() {
    return new PanelFavorites();
}
