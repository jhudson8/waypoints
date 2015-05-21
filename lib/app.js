
Number.prototype.toRad = function () {
	return this * Math.PI / 180;
}
Number.prototype.toDeg = function () { // convert radians to degrees (signed)
	return this * 180 / Math.PI;
}
Number.prototype.toBrng = function () { // convert radians to degrees (as bearing: 0...360)
	return (this.toDeg() + 360) % 360;
}

function giveUp() {
	if (confirm('Are you sure you want to be a quitter?')) {
		Backbone.history.navigate('fail', {trigger: true});
	};
}

function numArr(max) {
	var arr = [];
	for (var i = 1; i <= max; i++) {
		arr.push(i + '');
	}
	return arr;
}

var CACHE_TIMER = 8000,
	FEET_PER_PACE = 2.5,
	IMAGE_PREFIX = 'images/',
	IMAGE_TYPES = {
		fail: {
			src: numArr(10),
			format: 'images/fail/{img}.jpeg'
		},
		win: {
			src: numArr(13),
			format: 'images/win/{img}.jpeg'
		}
	};

var cache, points, profiles, games = {
		satellite: {
			name: 'Satellite',
			getImage: function (point) {
				return IMAGE_PREFIX + 'satellite' + '/' + point.id + '.jpeg';
			},
			shortDescription: 'Find waypoints from satellite image markers.',
			description: 'Find waypoints identified by a satellite image and enter the code you see on the waypoint marker.'
		},
		perspective: {
			name: 'Point of View',
			getImage: function (point) {
				return IMAGE_PREFIX + 'perspective' + '/' + point.id + '.jpg';
			},
			shortDescription: 'Find waypoints using photos taken from the exact locations that you seek.',
			description: 'You will be shown pictures that were taken from the waypoint you seek\s exact location.  Find the waypoint markers and enter the code.  <br><br><strong>Note: these are not pictures of the waypoints - but what you would see if you stood where the marker is.</strong>'
		},
		mixed: {
			getImage: function (point, index) {
				if (index % 2 == 0) {
					return IMAGE_PREFIX + 'perspective' + '/' + point.id + '.jpg';
				} else {
					return IMAGE_PREFIX + 'satellite' + '/' + point.id + '.jpeg';
				}
			}
		},
		bearing: {
			name: 'Treasure Hunt',
			getView: function (step, steps) {
				if (steps.stepNum === 0) {
					// they have to get to the first place
					return new PointView({
						name: 'treasure-hunt-start',
						step: step,
						game: games.satellite
					})
				} else {
					var prevStep = steps.at(steps.stepNum - 1),
						_bearing = Math.floor(bearing(prevStep, step)),
						distance = distanceFeet(prevStep, step);
					return new BearingView({
						bearing: _bearing,
						direction: direction(_bearing),
						distance: distance
					});
				}
			},
			stepCountDelta: 1,
			getImage: function(point) {
				return games.satellite.getImage.call(this, point);
			},
			shortDescription: 'Find waypoints from treasure map style directions',
			description: 'Just like a cartoon treasure map, you\'ll be told which way to go and how many paces to walk to find the waypoint.'
		}
	}

var View = Backbone.View.extend({
	initialize: function (options) {
		_.extend(this, options);
		this.init && this.init(options);
	},
	render: function (context) {
		var template = $('#' + this.name).html();
		this.$el.html(_.template(template)(context || this));
	}
});

IntroView = View.extend({
	name: 'intro'
});

BearingView = View.extend({
	name: 'bearing',
	init: function() {
		var paces = Math.floor(this.distance / FEET_PER_PACE);
		paces = paces - (paces % 5);
		this.paces = paces;
	},
	events: {
		'submit form': function (event) {
			event.preventDefault();
			var code = this.$('#keyCode').val();
			if (code) {
				Backbone.history.navigate('code/' + code, {
					replace: true,
					trigger: true
				});
			}
		}
	},
	render: function() {
		View.prototype.render.call(this);
		var width = $('.compass').width();
		var cmd = 'rotate(' + this.bearing + 'deg' + ')';
		this.$('.compass-arrow').css({
			'width': width + 'px',
			'height': width + 'px'
		});
		this.$('.compass-arrow').css({
			'-moz-transform': cmd,
			'-webkit-transform': cmd
		});
	}
});

var CachedImageView = View.extend({
	render: function (options) {
		View.prototype.render.call(this, options);
		var img = this.getImage();
		_.defer(_.bind(function () {
			if (_.isString(img)) {
				this.$('.image-container').html('<img src="' + img + '">');
			} else {
				this.$('.image-container').html('').append(img);
			}
		}, this));
	}
});

var MajorEventView = CachedImageView.extend({
	getImage: function () {
		var imageData = IMAGE_TYPES[this.name],
			steps = getSteps(),
			imgKey = imageData.src[steps[this.name]],
			imgSrc = imageData.format.replace('{img}', imgKey);
		return cache && cache.images && cache.images[this.name] || imgSrc;
	}
});

var StepImageView = CachedImageView.extend({
	name: 'point-image',
	events: {
		'click img': doubleclick(function () {
			window.history.back();
		})
	},
	render: function() {
		CachedImageView.prototype.render.apply(this, arguments);
		this.$el.addClass('full-image');
	},

	getImage: function () {
		return cache && cache.images[this.step.id] && cache.images[this.step.id] || this.game.getImage(this.step, getSteps().stepNum);
	}
});

function doubleclick(callback) {
	return function(event) {
		event.stopPropagation();
		var _lastClick = this.lastClick || 0;
		this.lastClick = new Date().getTime();
		var diff = this.lastClick - _lastClick;
		if (diff < 300) {
			lastClick = 0;
			callback.apply(this, arguments);
		}
	};
};

var PointView = CachedImageView.extend({
	name: 'point',
	events: {
		'submit form': function (event) {
			event.preventDefault();
			var code = this.$('#keyCode').val();
			if (code) {
				Backbone.history.navigate('code/' + code, {
					replace: true,
					trigger: true
				});
			}
		},
		'click img': doubleclick(function() {
			Backbone.history.navigate('image-full', {
				replace: false,
				trigger: true
			});
		})
	},
	getImage: function () {
		return cache && cache.images[this.step.id] && cache.images[this.step.id] || this.game.getImage(this.step, getSteps().stepNum);
	}
});

var SettingsView = View.extend({
	name: 'settings',
	events: {
		'click .actions > button': function (event) {
			var btn = $(event.currentTarget),
				type = btn.data('type'),
				value = btn.attr('data-' + type);
			if (type === 'numSteps') {
				value = parseInt(value, 10);
			}
			var origValue = defaults[type];
			setDefault(type, value);
			this.$('[data-' + type + '="' + origValue + '"]').removeClass('btn-primary').addClass('btn-default');
			this.$('[data-' + type + '="' + value + '"]').removeClass('btn-default').addClass('btn-primary');
			if (type === 'game') {
				this.refreshGameInfo();
			}
		}
	},
	render: function () {
		View.prototype.render.call(this, _.defaults({
			label: this.label || 'Start the hunt!'
		}, defaults));
		this.enable(['game', 'numSteps', 'profile']);
		this.refreshGameInfo();
	},
	refreshGameInfo: function() {
		var game = games[getDefaults().game];
		this.$('.game-description').html(game.shortDescription);
	},
	enable: function (types) {
		for (var i = 0; i < types.length; i++) {
			var type = types[i],
				value = defaults[type];
			this.$('[data-' + type + '="' + value + '"]').removeClass('btn-default').addClass('btn-primary');
		}
	}
});

var Workspace = Backbone.Router.extend({

	routes: {
		"start": "start",
		"intro": "intro",
		"current": "current",
		"image-full": "fullImage",
		"step/:id": "step",
		"code/:code": "code",
		"change/:type/:value": "change",
		"settings": "settings",
		"fail": "fail",
		"finish": "showFinish",
		"bearingTest/:from/:to": "bearingTest",
		"": "settingsOrCurrent"
	},

	bearingTest: function(from, to) {
		var fromStep = points.get(from),
			toStep = points.get(to);
			_bearing = Math.floor(bearing(fromStep, toStep)),
			distance = distanceFeet(fromStep, toStep);
		var view = new BearingView({
			bearing: _bearing,
			direction: direction(_bearing),
			distance: distance
		});
		showView(view);
	},

	change: function (type, value) {
		if (type === 'numSteps') {
			value = parseInt(value, 10);
		}
		setDefault(type, value);
		Backbone.history.navigate('settings', {
			trigger: true,
			replace: false
		});
	},

	settingsOrCurrent: function () {
		var steps = getSteps();
		if (steps) {
			this.current();
		} else {
			this.settings();
		}
	},

	settings: function () {
		showView(new SettingsView());
	},

	fail: function () {
		showView(new MajorEventView({
			name: 'fail'
		}));
		Backbone.history.navigate('', {
			trigger: false,
			replace: true
		});
		storeValue(undefined);
		var self = this;
		setTimeout(function () {
			self.settingsOrCurrent();
		}, 6000);
	},

	start: function (game) {
		var steps = generateSteps(game);
		var s = '';
		for (var j = 0; j < steps.length; j++) {
			s += steps.at(j).get('code');
			s += ', ';
		}
		console.log(s);

		message('Saving your images...');
		cacheRoute(steps, _.bind(function () {
			this.intro();
		}, this));
	},

	intro: function (type, value) {
		var steps = getSteps();
		if (steps) {
			// show intro
			showView(new IntroView({game: steps.game}));
		} else {
			this.settingsOrCurrent();
		}
	},

	step: function (stepId) {
		stepController(stepId, this);
	},

	code: function (code) {
		// find the stepId for the code
		var stepId = -1;
		points.each(function (step) {
			if (step.get('code') == code) {
				stepId = step.id;
			}
		});
		stepController(stepId, this);
	},

	current: function () {
		var steps = getSteps();
		this.showCode(steps.at(steps.stepNum), steps);
	},

	fullImage: function () {
		var steps = getSteps(),
			stepData = steps.at(steps.stepNum);
		var view = new StepImageView({
			step: stepData,
			game: steps.game
		});
		showView(view);
	},

	showFinish: function () {
		Backbone.history.navigate('', {
			replace: true,
			trigger: false
		});
		var steps = getSteps();
		var time = new Date().getTime();
		diff = (time - steps.startTime) / 1000,
		secs = Math.floor(diff % 60),
		mins = Math.floor(diff / 60);

		showView(new MajorEventView({name: 'win'}), {time: mins + ' minutes, ' + secs + ' seconds'});
	},

	showCode: function (stepData, steps, fromStart) {
		var view = steps.game.getView && steps.game.getView(stepData, steps)
			|| new PointView({
				step: stepData,
				game: steps.game
			});
		showView(view);
		Backbone.history.navigate('current', {
			replace: !fromStart,
			trigger: false
		});
	},

	showInvalidStep: function (invalidStepId, currentStep, steps) {
		var invalidStep = points.get(invalidStepId);
		var _message;
		if (invalidStep) {
			var dist = Math.floor(distanceFeet(invalidStep, currentStep)),
				_bearing = Math.floor(bearing(invalidStep, currentStep));
			if (dist > 250) {
				_message = 'Whoah, where are you?  <br><br> You are ' + dist + ' feet away...';
			} else if (dist < 40) {
				_message = 'You are sooo close...  <br><br> Only ' + dist + ' feet away...';
			} else {
				_message = 'Not there yet!  <br><br>  You are ' + dist + ' feet away...';
			}
		} else {
			_message = 'Not even close.  Are you just making numbers up?';
		}

		message(_message, this.current, this);
	},

	showInvalidState: function () {
		message("You haven't started a hunt...");
		setTimeout(_.bind(function () {
			this.start();
		}, this), 3000);
	}
});

function cacheRoute(steps, callback) {
	cache = {
		images: {}
	};
	game = steps.game;
	var images = {},
		count = 0,
		cacheTimer;

	cacheTimer = setTimeout(function () {
		callback();
	}, CACHE_TIMER);

	function onLoad() {
		images[this.src] = true;
		cache.images[this.step.id] = this.img;

		if (!cache.images.win || !cache.images.fail) {
			return;
		}
		if (game.getImage) {
			for (var j = 0; j < steps.length; j++) {
				var imgSrc = game.getImage(steps.at(j), j);
				if (!images[imgSrc]) {
					return;
				}
			}
		}
		clearTimeout(cacheTimer);
		callback();
	}

	// win and fial images
	_.each([{
		type: 'win',
		src: IMAGE_TYPES.win.src[steps.win],
		format: IMAGE_TYPES.win.format
	}, {
		type: 'fail',
		src: IMAGE_TYPES.fail.src[steps.fail],
		format: IMAGE_TYPES.fail.format
	}, ], function (data) {
		var imgSrc = data.format.replace('{img}', data.src),
			img = new Image();
		img.onload = _.bind(onLoad, {
			src: imgSrc,
			step: {
				id: data.type
			},
			img: img
		});
		img.src = imgSrc;
		images[data.type] = false;
	});

	if (game.getImage) {
		_.each(steps.models, function (step) {
			var imgSrc = game.getImage(step, count++),
				img = new Image();
			img.onload = _.bind(onLoad, {
				src: imgSrc,
				step: step,
				img: img
			});
			img.src = imgSrc;
			images[imgSrc] = false;
		});
	}
}

function stepController(stepId, context) {
	var stepData = getSteps();
	if (stepData && stepId) {
		stepId = parseInt(stepId, 10);
		if (stepId === stepData.at(stepData.stepNum).id) {
			if (incrementStep(stepData)) {
				context.showFinish();
				storeValue(undefined);
				Backbone.history.navigate('', {
					replace: true,
					trigger: false
				});
			} else {
				var toGo = stepData.length - stepData.stepNum,
					_message;
				if (toGo === 1) {
					_message = 'Almost there... 1 more to go';
				} else {
					var phrases = ['Yippee you found it, ' + toGo + ' to go', 'Good job, ' + toGo + ' to go', 'That was fast!  Only ' + toGo + ' more', 'Look at you go!  ' + toGo + ' left'],
						rand = randInt(0, phrases.length - 1);
					_message = phrases[rand];

				}
				message(_message, function () {
					context.showCode(stepData.at(stepData.stepNum), stepData);
				});
			}
		} else {
			context.showInvalidStep(stepId, stepData.at(stepData.stepNum), stepData);
		}
	} else {
		context.showInvalidState();
	}
}

function randAllocation(allocations) {
	var rand = Math.random();
	rand = rand * 100;
	var sum = 0,
		allocation;
	for (var i = 0; i < allocations.length; i++) {
		sum += allocations[i][2];
		if (rand < sum) {
			// match
			allocation = allocations[i];
			break;
		}
	}
	if (!allocation) {
		throw ("invalid allocation: " + rand);
	}
	return allocation;
}

function isWithinRange(stepA, stepB, allocation) {
	var diff = Math.max(stepA.get('zoneX') - stepB.get('zoneX')) + Math.max(stepA.get('zoneY') - stepB.get('zoneY'));
	return (diff >= allocation[0] && diff <= allocation[1]);
}

function findStep(currentStep, availablePlaces, allocations) {
	var allocation = randAllocation(allocations);
	_availablePlaces = _.filter(availablePlaces, function (model) {
		return (!currentStep || isWithinRange(currentStep, model, allocation));
	});
	if (_availablePlaces.length == 0) {
		_availablePlaces = availablePlaces;
	}

	return _availablePlaces[randInt(0, _availablePlaces.length - 1)];
}

function generateSteps(game) {
	var gameType = game || defaults.game,
		gameInfo = games[gameType],
		profileData = profiles[gameType] || profiles['default'];
	profileInfo = profileData[defaults.profile || 'standard'],
	allocations = profileInfo.allocations,
	availablePlaces = _.filter(points.models, function (model) {
		var rating = model.get('rating');
		return (rating >= profileInfo.minRating && rating <= profileInfo.maxRating);
	});

	var placeIds = [],
		currentStep,
		numSteps = defaults.numSteps + (gameInfo.stepCountDelta || 0);

	while (placeIds.length < numSteps && availablePlaces.length > 0) {
		currentStep = findStep(currentStep, availablePlaces, allocations);
		var index = availablePlaces.indexOf(currentStep);

		placeIds.push(currentStep.id);
		availablePlaces.splice(index, 1);
	}

	var data = {
		game: gameType,
		stepNum: 0,
		startTime: new Date().getTime(),
		steps: placeIds,
		win: randInt(0, IMAGE_TYPES.win.src.length - 1),
		fail: randInt(0, IMAGE_TYPES.fail.src.length - 1),
	}
	storeValue(data);
	return getSteps();
}

function incrementStep(steps) {
	var data = steps.data;
	data.stepNum++;
	storeValue(data);
	steps.stepNum = data.stepNum;
	return (steps.stepNum === defaults.numSteps);
}

function getSteps() {
	var data = getStoredValue();
	if (data) {
		var steps = _.map(data.steps, function (id) {
			return points.get(id);
		});
		var rtn = new Backbone.Collection();
		rtn.reset(steps);
		_.defaults(rtn, data);
		rtn.game = games[rtn.game];
		rtn.data = data;
		return rtn;
	}
}

function randInt(low, high) {
	var rand = Math.random(),
		range = high - low + 1;
	return Math.floor(rand * range) + low;
}

function getDefaults() {
	var rtn = getStoredValue('defaults');
	if (!rtn) {
		var defaults = {
			numSteps: 6,
			zoneSpan: -1,
			game: 'satellite',
			profile: 'standard'
		};
		storeValue('defaults', defaults);
		return defaults;
	} else {
		return rtn;
	}
}

function setDefault(name, val) {
	defaults[name] = val;
	storeValue(defaults, 'defaults');
}

function storeValue(value, name) {
	if (value) {
		localStorage.setItem(name || COOKIE_ID, JSON.stringify(value));
	} else {
		localStorage.removeItem(name || COOKIE_ID);
	}
}

function getStoredValue(name) {
	var rtn = localStorage.getItem(name || COOKIE_ID);
	if (rtn) {
		return JSON.parse(rtn);
	}
}

function pointsArrayMap(item, index) {
	// ["id", "code", "latitude", "longitude", "zoneY", "zoneX", "rating"]
	if (item[0] > 0) {
		return {
			id: item[0],
			code: item[1],
			latitude: item[2],
			longitude: item[3],
			zoneY: item[4],
			zoneX: item[5],
			rating: item[6] || 2
		}
	}
}

function message(_message, callback, context) {
	var view = new View({
		name: 'message'
	});
	showView(view, {message: _message});
	if (callback) {
		setTimeout(_.bind(callback, context || window), 3000);
	}
}

function showView(view, context) {
	var el = $('.container');
	el.html('');
	view.render(context);
	el.append(view.el);
}

function distanceFeet(point1, point2) {
	var lat1 = point1.get('latitude'),
		lat2 = point2.get('latitude'),
		lon1 = point1.get('longitude'),
		lon2 = point2.get('longitude');

	var R = 3963; // radius in miles
	var dLat = (lat2 - lat1).toRad();
	var dLon = (lon2 - lon1).toRad();
	var lat1 = lat1.toRad();
	var lat2 = lat2.toRad();

	var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return Math.ceil(R * c * 5280);
}

var deg2Rad = function (value) {
	// converts numeric degress to radians
	return value * Math.PI / 180;
}
var rad2Deg = function (value) {
	//convert radians to degress
	return value * 180 / Math.PI;
}

	function bearing(from, to) {
		var lat1 = from.get('latitude'),
			lat2 = to.get('latitude'),
			lon1 = from.get('longitude'),
			lon2 = to.get('longitude'),
			dLat = (lat2 - lat1).toRad(),
			dLon = (lon2 - lon1).toRad();

		//difference in the phi of latitudinal coordinates
		var dPhi = Math.log(Math.tan(deg2Rad(lat2) / 2 + Math.PI / 4) / Math.tan(deg2Rad(lat1) / 2 + Math.PI / 4));

		//we need to recalculate $dLon if it is greater than pi
		if (Math.abs(dLon) > Math.PI) {
			if (dLon > 0) {
				dLon = (2 * Math.PI - dLon) * -1;
			} else {
				dLon = 2 * Math.PI + dLon;
			}
		}
		//return the angle, normalized
		return (rad2Deg(Math.atan2(dLon, dPhi)) + 360) % 360;
	}

	function direction(bearing) {
		var positions = ['North', 'NNE', 'North East', 'ENE', 'East', 'ESE', 'South East', 'SSE', 'South', 'SSW', 'South West', 'WSW', 'West', 'WNW', 'North West', 'NNW']
			step = 360 / positions.length,
			start = 0,
			end = start + step;
		bearing = (bearing + (step / 2)) % 360;
		for (var i=0; i<positions.length; i++) {
			if (bearing >= start && bearing <= end) {
				return positions[i];
			}
			start += step;
			end += step;
		}
	}

$('.container').ready(function () {
	$.ajax({
		dataType: "json",
		url: 'data.json',
		success: function (data) {

			var _codes = {};
			_.each(data.points, function (point) {
				var code = point[1];
				if (_codes[code]) {
					alert('invalid code: ' + code);
				}
				_codes[code] = true;
			});

			profiles = data.profiles;
			points = new Backbone.Collection();
			points.reset(_.map(_.compact(data.points), pointsArrayMap));

			new Workspace();
			Backbone.history.start();
		},
		error: function (xhr, type, error) {
			alert(error);
		}
	});
});

var COOKIE_ID = 'hunt',
	defaults = getDefaults();
