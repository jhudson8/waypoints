// override local storage
var data = {};
function storeValue(value, name) {
  data[name || 'main'] = value
}
function getStoredValue(name) {
  return data[name || 'main'];
}
/*

test( "printSteps", function() {
	var values = {};
	for (var i=0; i<20; i++) {
		var steps = generateSteps();
		var s = '';
		for (var j=0; j<steps.length; j++) {
			s += steps.at(j).id;
			s += ', ';
		}
		console.log(s);
	}
});
*/

test( "randInt", function() {
	var values = {};
	for (var i=0; i<100; i++) {
		var val = randInt(1, 4);
		if (!values[val]) {
			values[val] = 1;
		} else {
			values[val] = values[val] + 1;
		}
		if (val < 1 || val > 4) {
			ok(false, 'invalid randInt value: ' + val);
		}
	}
	ok(values[1] > 0);
	ok(values[2] > 0);
	ok(values[3] > 0);
	ok(values[4] > 0);
});


test('stepController', function() {
	setDefault('numSteps', 8);
	var data = generateSteps();

	var showFinish,
		showCode,
		showInvalidStep,
		showInvalidState,
		context = {
			showFinish: function(steps) {
		    	showFinish ++;
		  	},

		  	showCode: function(stepData, steps) {
		    	showCode = stepData;
		  	},

		  	showInvalidStep: function(steps) {
		      	showInvalidStep ++;
		  	},

		  	showInvalidState: function() {
		      showInvalidState ++;
			},
			reset: function() {
				showFinish = 0;
				showCode = false;
				showInvalidStep = 0;
				showInvalidState = 0;
			}
		};
	context.reset();

	function cStep() {
		data = getSteps();
		return data.at(data.stepNum);
	}

	var step = cStep(),
		invalidStep = data.at(1),
		stepNum = 0;

	stepController(invalidStep.id, context);
	equal(showInvalidStep, 1);

	var count = data.length - 1;
	while (count-- > 0) {
		stepController(step.id, context);
		step = cStep();
		equal(showCode.id, step.id, 'Valid step code provided');
		equal(data.stepNum, stepNum+1);
		stepNum = data.stepNum;
		context.reset();
	}

	step = cStep();
	equal(step, data.models[data.length-1], '1 step left');

	stepController(step.id, context);
	equal(showFinish, 1, 'Finish was shown');

	context.reset();
	stepController(step.id, context);
	equal(showInvalidState, 1, 'Invalid state shown after finish');
});

test("generateSteps", function() {
	setDefault('numSteps', 4);
	var val = generateSteps();
	equal(val.length, 4);

	setDefault('numSteps', 10);
	val = generateSteps('basic');
	equal(val.length, 10);

	// check the data structure
	equal(val.stepNum, 0, 'Valid initial stepNum');
	equal(!!val.data, true, 'Serialization data is set');
	equal(val.type, 'basic', 'Type is basic');

	setDefault('type', 'advanced');
	val = generateSteps();
	equal(val.type, 'advanced', 'Default type is used if none is passed');

	var model = val.at(0);
	equal(_.isUndefined(model.get('latitude')), false, 'Model latitude exists');
	equal(_.isUndefined(model.get('longitude')), false, 'Model longitude exists');
	equal(_.isUndefined(model.get('rating')), false, 'Model rating exists');
	equal(_.isUndefined(model.get('zoneX')), false, 'Model zoneX exists');
	equal(_.isUndefined(model.get('zoneY')), false, 'Model zoneY exists');


	// make sure no duplicate steps are added
	setDefault('numSteps', 25);
	for (var i=0; i<20; i++) {
		val = generateSteps();
		var hash = {};
		_.each(val.models, function(model) {
			var id = model.id;
			if (hash[id]) {
				ok(false, 'Duplicate step error');
			} else {
				hash[id] = true;
			}
		});
	}
});

