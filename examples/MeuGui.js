import { GUI } from './jsm/libs/dat.gui.module.js';

function MeuGui(display) {
	if (display) {
		this.gui = new GUI();
	} else {
		this.gui = undefined;
	}
	
	this.add = function (controller, prop, funcao, ini, fim, step) {
		if (this.gui != undefined) {
			if (ini == undefined) {
				this.gui.add(controller, prop).name(prop).onChange(funcao);
			} else {
				this.gui.add(controller, prop, ini, fim).step(step).name(prop).onChange(funcao);
			}
		}
	};

	this.addColor = function (controller, prop, funcao) {
		if (this.gui != undefined) {
			this.gui.addColor(controller, prop).name(prop).onChange(funcao);
		}
	};
}

export { MeuGui };