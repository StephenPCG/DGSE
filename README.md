# DGSE(Deepin Gnome-Shell Extensions)

DGSE, written by Linux Deepin developing team,can be used to other distros' GNOME Shell environment than Linux Deepin.

### DGSE List: 

* noa11y extension
* User themes extension
* Monitor Status extension
* hidedash extension
* Dock extension
* sytem-monitor extension
* windowNavigator extension
* nocliktab extension
* hideusername extension
* Show Desktop Button extension
* Removable Drive Menu extension
* Windows Alt Tab extension
* WindowsOverlay Icons extension
* Shutdown Menu extension
* Workspace Navigator extension
* gnome-shell-classic-systray extension


### ScreenShots

![alt Linux Deepin desktop screenshot](http://i.imgur.com/qaIVQ.jpg)
![alt gnome tweak tool](http://i.imgur.com/YEc85.png)
![alt app categories](http://i.imgur.com/S3Uz5.jpg)
![alt workspace display area left placed](http://i.imgur.com/YnIfm.jpg)

### Extensions' features discription

noa11y extension: 
User themes extension: 
Monitor Status extension: 
hidedash extension: Hide login user name,just left an user status icon in the top-right screen.
Dock extension: Deepin dock. It's placed at the top panel of Deepin Gnome Shell. 
sytem-monitor extension: 
windowNavigator extension: 
nocliktab extension: 
hideusername extension: 
Show Desktop Button extension: for showing desktop. 
Removable Drive Menu extension: 
Windows Alt Tab extension: 
WindowsOverlay Icons extension: 
Shutdown Menu extension: 
Workspace Navigator extension: 
gnome-shell-classic-systray extension:

### Install:

the following method can be used for all the GNOME Shell users.

Tips: you would better enable all the installed GNOME Shell extensions via gnome tweak tool. 

	git clone git://github.com/manateelazycat/DGSE.git
	mv DGSE/* ~/.local/share/gnome-shell/extensions
	ln -s system-monitor/system-monitor@linuxdeepin.com/ .
	ln -s user-theme/user-theme@gnome-shell-extensions.gnome.org/ .
	
Then you can use gnome tweak tool to enable the DGSE.

But if you want to totally experience the Deepin GNOME Shell,there is  something to do:

	git clone git://github.com/manateelazycat/deepin-gnome-shell.git
	sudo rm -rf /usr/share/gnome-shell/js/ui/ 
	sudo mv deepin-gnome-shell/js/ui /usr/share/gnome-shell/js/

Then you should download deepin-gs-theme

	git clone git://github.com/manateelazycat/deepin-gs-theme
	mv deepin-gs-theme/ ~/.themes

Last, press "Alt+F2", input "r", reload the GNOME Shell.

Just Enjoy it!

### BUGS

IF bugs when using Linux Deepin, users can report them at <http://www.linuxdeepin.com/forum>.

### License:

Copyright (C) 2011 Linux Deepin team

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public 
License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later 
version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied 
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see 
<http://www.gnu.org/licenses/>.
  
