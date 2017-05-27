App = function() {
	
	this.loadConfig=function(){};
	
}

StateManager = function(owner) {
	this.timeouts = new Array();
	this.intervals = new Array();
	this.state = "";
	this.active = false;
	this.owner = owner;
	this.stateInits = {};
	this.stateResumes = {};
	this.statePauses = {};
	this.stateFirstVisit = {};
	
	this.pauseAllTimeouts = function(){};
	this.pauseAllIntervals = function(){
		for(i = 0; i < this.intervals.length; i++) {
			this.intervals[i].pauseInterval();
		}
	};
	this.restoreTimeouts = function(){};
	this.restoreIntervals = function(){};
	
	this.addInterval = function(callback, duration, states) {
		interval = new StateManager.Interval(callback, duration, "interval", states);
		this.intervals.push(interval);
	};
	
	this.addTimeout = function(callback, duration, states) {
		interval = new StateManager.Interval(callback, duration, "timeout", states);
		this.timeouts.push(interval);
	};
	
	this.clearInterval = function(interval) {
		i = this.intervals.indexOf(interval);
		if(i >= 0) {
			this.intervals.splice(i,1);
		}
	};
	
	this.clearTimeout = function(interval) {
		i = this.timeouts.indexOf(interval);
		if(i >= 0) {
			this.timeouts.splice(i,1);
		}
	};
	
	this.switchState = function(state){
		if(this.statePauses[this.state]) {
			this.statePauses[this.state].call();
		}
		
		this.state = state;
		
		//restore/pause appropriate intervals
		for(i = 0; i < this.intervals.length; i++) {
			samestate = false;
			for(j = 0; j < this.intervals[i].states.length; j++) {
				if(this.intervals[i].states[j] == state) {
					samestate = true;
				}
			}
			if(samestate) {
				this.intervals[i].restoreInterval();
			} else {
				this.intervals[i].pauseInterval();
			}
		}
		
		//restore/pause appropriate timeouts
		for(i = 0; i < this.timeouts.length; i++) {
			samestate = false;
			for(j = 0; j < this.timeouts[i].states.length; j++) {
				if(this.timeouts[i].states[j] == state) {
					samestate = true;
				}
			}
			if(samestate) {
				this.timeouts[i].restoreInterval();
			} else {
				this.timeouts[i].pauseInterval();
			}
		}
		if(!this.stateFirstVisit[state]) {
			if(this.stateInits[state]) this.stateInits[state].call();
		} else {
			if(this.stateResumes[state]) this.stateResumes[state].call();
		}
	};
}

StateManager.Interval = function(callback,duration, type, states){
	this.interval = null;
	this.duration = 0;
	this.timeRemaining = 0;
	this.lastFiredAt = 0;
	this.callback = null;
	this.intervalOrTimeout = type;
	this.states = states;
	this.paused = false;
	
	this.pauseInterval = function(){
		if(this.paused) return;
		this.paused = true;
		this.timeRemaining = this.duration - (Date.now() - this.lastFiredAt);
		clearTimeout(this.interval);
		console.log("pausing with " + this.timeRemaining + " remaining");
	};
	this.restoreInterval = function(){
		if(!this.paused) return;
		this.restore(this);
	};
	
	this.restore = function(interval) {
		this.paused = false;
		this.lastFiredAt = Date.now() - (this.duration - this.timeRemaining);
		this.interval = setTimeout(function(){
			interval.repeat(interval);
		}, this.timeRemaining);
		console.log("resuming with " + this.timeRemaining + " remaining");
	}
	
	this.clearInterval = function(){
		clearInterval(this.interval);
	};
	this.repeat = function(interval) {
		this.interval = setTimeout(function(){
			callback.call();
			interval.lastFiredAt = Date.now();
			clearTimeout(interval.interval);
			if(interval.intervalOrTimeout == "interval") {
				interval.repeat(interval);
			}
		},this.duration);
	};
	
	this.duration = duration;
	this.lastFiredAt = Date.now();
	this.callback = callback;
	this.paused = false;
	this.repeat(this);
};

Game = function(app) {
	this.app = app;
	this.pieces = [];
	this.grid = [];
}

StandardGame = function(app) {
	Game.call(this);
	//Replace these with pulling which subclass to use from config in the superclass
	this.stateManager = new StandardStateManager(this);
	this.queueManager = new StandardQueueManager(this);
	this.renderManager = new StandardRenderManager(this);
	this.gameConfigManager = new GameConfigManager(this);
	this.inputManager = new StandardInputManager(this);
	this.rotateManager = new StandardRotateManager(this);
	this.x = 4;
	
	this.das = 24;
	this.dasRemaining = 24;
	this.lefting = false;
	this.moveDelay = 8;
	
	this.init = function() {
			this.grid = new Array(10);
			for(i = 0; i < 10; i++) {
				this.grid[i] = new Array(18);
				for(j = 0; j < 18; j++) {
					this.grid[i][j] = "";
				}
			}
			game = this;
			this.pieces.push(this.newPiece());
			this.stateManager.switchState("playing");
			this.stateManager.addInterval(function(){game.update();}, 16, ["playing"]);
	};
	
	this.update = function() {
		if(this.inputManager.getLeft()) {
			if(!this.lefting) {
				this.move(this.pieces[0],[[-1,0],[-1,0],[-1,0],[-1,0]]);
				this.lefting = true;
				this.dasRemaining = this.das;
			} else {
				if(this.dasRemaining > 0) {
					this.dasRemaining--;
				} else {
					if(this.moveDelayRemaining > 0) {
						this.moveDelayRemaining--;
					} else {
						this.move(this.pieces[0],[[-1,0],[-1,0],[-1,0],[-1,0]]);
						this.moveDelayRemaining = this.moveDelay;
					} 
				}
			}
				this.inputManager.resolveLeft();
		} else {
			this.lefting = false;
		}
		if(this.renderManager) {
			this.renderManager.render();
		}
	};
	
	this.newPiece = function() {
		piece = new Standard_T(this);
		this.force(piece);
		return piece;
	};
	
	this.force = function(piece) {
		if(piece.oldpos) {
			for(i = 0; i < piece.oldpos.length; i++) {
				this.grid[piece.oldpos[i][0]][piece.oldpos[i][1]] = "";
			}
		}
		for(i = 0; i < piece.pos.length; i++) {
			this.grid[piece.pos[i][0]][piece.pos[i][1]] = piece.type;
		}
	};
	
	this.move = function(piece, dir) {
		oldpos = piece.pos.slice();
		
		for(p = 0; p < piece.pos.length; p++) {
			this.grid[piece.pos[p][0]][piece.pos[p][1]] = "";
		}
		
		canmove = true;
		
		for(p = 0; p < piece.pos.length; p++) {
			x = piece.pos[p][0] + dir[p][0];
			y = piece.pos[p][1] + dir[p][1];
			if(x < 0 || x >= this.grid.length || y < 0 || y >= this.grid[0].length || this.grid[x][y] != "") {
				canmove = false;
				break;
			}
		}
		
		if(canmove) {
			for(p = 0; p < piece.pos.length; p++) {
				x = piece.pos[p][0] + dir[p][0];
				y = piece.pos[p][1] + dir[p][1];
				this.grid[x][y] = piece.type;
				piece.pos[p][0] = x;
				piece.pos[p][1] = y;
			}
		} else {
			for(p = 0; p < piece.pos.length; p++) {
				x = oldpos[p][0];
				y = oldpos[p][1];
				this.grid[x][y] = piece.type;
				piece.pos[p][0] = x;
				piece.pos[p][1] = y;
			}
		}
		return canmove;
	};
	
	this.init();
};

RenderManager = function(game) {
	this.game = game;
};

QueueManager = function(game){
	this.game = game;
};

InputManager = function(game) {
	this.game = game;
}

GameConfigManager = function(game) {
	this.game = game;
	this.config = {mode: "standard"};
};

StandardRenderManager = function(game) {
	RenderManager.call(this);
	this.game = game;
	canvas = document.getElementById("tetrisBox");
	ctx = canvas.getContext("2d");
	
	
	
	this.renderT = function(ctx, x, y, scale) {
		ctx.fillStyle = "#dd1111";
		ctx.fillRect(x,y,scale,scale);
	};
	
	this.fillStyles = {
		"T" : this.renderT,
	};
	
	this.render = function() {
		scale = 24;
		game = this.game;
		width = game.grid.length;
		height = game.grid[0].length;
		
		bottom = (height-1)*scale;
		
		ctx.clearRect(0, 0,canvas.width, canvas.height);
		ctx.fillStyle = "#dddddd";
		
		for(i = 0; i < width; i++) {
			for(j = 0; j < height; j++) {
				y = bottom - j*scale;
				x = i*scale;
				
				ctx.fillStyle = "#ffffff";
				ctx.fillRect(x,y,scale,scale);
				ctx.fillStyle = "#dddddd";
				ctx.fillRect(x+1,y+1,scale-2,scale-2);
				
				if(game.grid[i][j] != "") {
					this.fillStyles[game.grid[i][j]](ctx, x,y,scale);
				}
			}
		}
	};
}

StandardQueueManager = function(game) {
	QueueManager.call(this);
}

StandardStateManager = function(game) {
	StateManager.call(this);
}

StandardInputManager = function(game) {
	InputManager.call(this);
	this.leftPressed = false;
	this.rightPressed = false;
	this.leftHeld = false;
	this.rightHeld = false;
	inputManager = this;
	
	document.addEventListener('keydown', function(event) {

		if(event.keyCode == 37) {
			inputManager.leftPressed = true;
			inputManager.leftHeld = true;

		}
		if(event.keyCode == 39) {

			inputManager.rightPressed = true;
			inputManager.rightHeld = true;
		}
	});
	
	document.addEventListener('keyup', function(event) {
		if(event.keyCode == 37) {
			inputManager.leftHeld = false;
			console.log("lift");
		}
		if(event.keyCode == 39) {
			inputManager.rightHeld = false;
		}
	});
	
	this.getLeft = function() {

		return this.leftPressed || this.leftHeld;
	}
	this.resolveLeft = function() {
		this.leftPressed = false;
	}
	
	this.getRight = function() {
		return this.RightPressed || this.RightHeld;
	}
	this.resolveRight = function() {
		this.RightPressed = false;
	}
}

StandardRotateManager = function(game) {
	this.game = game;
	
	this.T_c = [
		[
			[[1,1],[0,0],[-1,-1],[-1,1]]
		],
		[
			[[1,-1],[0,0],[-1,1],[1,1]]
		],
		[
			[[-1,-1],[0,0],[1,1],[-1,1]]
		],
		[
			[[1,-1],[0,0],[-1,1],[-1,-1]]
		]
	];
	
	this.rotate = function(piece, dir) {
		width = this.game.grid.length;
		height = this.game.grid[0].length;
		
		oldpos = piece.pos.slice();
		
		if(dir == "c") {
			if(piece.type == "T") {
				rules = this.T_c;
			}
		}
		
		rule = rules[piece.rotation];
		attempt = false;
		for(i = 0; i < rule.length; i++) {
			attempt = this.game.move(piece, rule[i]);
			if(attempt) {
				break;
			}
		}
		
		return attempt;
	}
}

Piece = function(game) {	
	this.game = game;
	this.pos = [];
	this.rotation = 0;
}

T = function(game) {
	Piece.call(this);
	this.type = "T";
}

Standard_T = function(game) {
	T.call(this);
	this.pos = [[3,16],[4,16],[5,16],[4,15]];
	this.fillStyle = "#dd1111";
}

//var testState = new StateManager();
//testState.addInterval(function(){console.log("test");},500, ["test"]);
//testState.addInterval(function(){console.log("test chicken");},500, ["test", "chicken"]);

var testApp = new App();
var testGame = new StandardGame(testApp);