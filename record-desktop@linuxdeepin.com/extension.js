
const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Shell = imports.gi.Shell;
const Gio = imports.gi.Gio;

let text, button, recorder, recorderSettings;
let recordFalg;

function toggleRecord() {
	if (recordFalg && recorder.is_recording()) {
		recorder.pause();
		recordFalg = false;
	} else {
        recorder.set_framerate(recorderSettings.get_int('framerate'));
        recorder.set_filename('shell-%d%u-%c.' + recorderSettings.get_string('file-extension'));
        let pipeline = recorderSettings.get_string('pipeline');

        if (!pipeline.match(/^\s*$/)) {
            recorder.set_pipeline(pipeline);
		} else {
            recorder.set_pipeline(null);
		}
		
		if (recorder.record()) {
			recordFalg = true;
		}
	}
}

function init() {
    button = new St.Bin({ style_class: 'panel-button',
                          reactive: true,
                          can_focus: true,
                          x_fill: true,
                          y_fill: false,
                          track_hover: true });
    let icon = new St.Icon({ icon_name: 'system-run',
                             icon_type: St.IconType.SYMBOLIC,
                             style_class: 'system-status-icon' });

    button.set_child(icon);
    button.connect('button-press-event', toggleRecord);
	
    recorderSettings = new Gio.Settings({ schema: 'org.gnome.shell.recorder' });
    recorder = new Shell.Recorder({ stage: global.stage });
	recordFalg = false;
}

function enable() {
    Main.panel._rightBox.insert_actor(button, 0);
}

function disable() {
    Main.panel._rightBox.remove_actor(button);
}
