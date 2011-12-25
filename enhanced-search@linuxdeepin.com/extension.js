/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* Asynchronous Gnote Search Provider for Gnome Shell
 *
 * Copyright (c) 2011 Casey Harkins <charkins@pobox.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

const Util = imports.misc.util;
const Main = imports.ui.main;
const DBus = imports.dbus;
const Lang = imports.lang;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Search = imports.ui.search;

const SEARCH_ENGINE_GOOGLE = "Google";
const SEARCH_ENGINE_BAIDU = "Baidu";
const SEARCH_ENGINE_YAHOO = "Yahoo";
const SEARCH_ENGINE_BING = "Bing";
const SEARCH_ENGINE_FLICKR = "Flickr";
const SEARCH_ENGINE_WIKIPEDIA = "Wikipedia";
const SEARCH_ENGINE_TWITTER = "Twitter";
const SEARCH_ENGINE_YOUTUBE = "YouTube";

const SEARCH_ENGINES = [{'uri': "http://www.google.com.hk/search?ie=UTF-8&q=",
                         'title': SEARCH_ENGINE_GOOGLE,
						 'icon': "google.png"
                        },
                        {'uri': "http://www.baidu.com/s?ie=utf8&wd=",
                         'title': SEARCH_ENGINE_BAIDU,
						 'icon': "baidu.png"
                        },
                        {'uri': "http://cn.search.yahoo.com/search?ie=UTF-8&p=",
                         'title': SEARCH_ENGINE_YAHOO,
						 'icon': "yahoo.png"
                        },
                        {'uri': "http://cn.bing.com/search?q=",
                         'title': SEARCH_ENGINE_BING,
						 'icon': "bing.png"
                        },
                        {'uri': "http://www.flickr.com/search/?f=hp&q=",
                         'title': SEARCH_ENGINE_FLICKR,
						 'icon': "flickr.png"
                        },
                        {'uri': "http://zh.wikipedia.org/wiki/",
                         'title': SEARCH_ENGINE_WIKIPEDIA,
						 'icon': "wikipedia.png"
                        },
                        {'uri': "https://twitter.com/search?q=",
                         'title': SEARCH_ENGINE_TWITTER,
						 'icon': "twitter.png"
                        },
                        {'uri': "http://www.youtube.com/results?search_query=",
                         'title': SEARCH_ENGINE_YOUTUBE,
						 'icon': "youtube.png"
                        }
                       ];

let searchProvidersBox = null;
let searchEngineProvider = null;
let currentPath = null;

function SearchEngineProvider() {
    this._init();
}

SearchEngineProvider.prototype = {
    __proto__: Search.SearchProvider.prototype,

    _init: function(name) {
        Search.SearchProvider.prototype._init.call(this, _("Search Engine"));
    },

    /* get the title and icon for a search result */
    getResultMeta: function(id) {
        let title = id.title;

        return { 'id': id,
                 'name': title,
                 'createIcon': function(size) {
					 let iconFile = Gio.file_new_for_path(currentPath + "/" + id.icon);
					 let fileIcon = new Gio.FileIcon({file: iconFile});
                     return new St.Icon({icon_size: size,
                                         gicon: fileIcon
					 					});
                 }

               };
    },


    /* display a note with search terms highlighted */
    activateResult: function(id, params) {
        Util.trySpawnCommandLine("xdg-open " + id.uri + id.search);
    },

    listSearchEngine: function(terms) {
        let searchString = encodeURIComponent(terms);

        for (let i = 0; i < SEARCH_ENGINES.length; i++) {
            SEARCH_ENGINES[i].search = searchString;
        }

        return SEARCH_ENGINES;
    },

    /* start asynchronous search for terms */
    getInitialResultSet: function(terms) {
        return this.listSearchEngine(terms);
    },

    getSubsearchResultSet: function(previousResults, terms) {
        return this.listSearchEngine(terms);
    }
};

function init(extensionMeta) {
	searchProvidersBox = Main.overview._viewSelector._searchTab._searchResults._searchProvidersBox;
	currentPath = extensionMeta.path;
}

function enable() {
    if(searchEngineProvider==null) {
        searchEngineProvider = new SearchEngineProvider();
        Main.overview.addSearchProvider(searchEngineProvider);
    }
	
	searchProvidersBox.hide_all();
}

function disable() {
    if(searchEngineProvider != null) {
        Main.overview.removeSearchProvider(searchEngineProvider);
        searchEngineProvider = null;
    }
	
	searchProvidersBox.show_all();
}
