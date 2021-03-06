var apps = {};
var selectedApp = null;

var clientStatus = null;
var serverStatus = "Connecting...";

function setStatus(value, client) {
	if (client) {
		clientStatus = value;
	} else {
		serverStatus = value;
	}	
	$('#status').html(clientStatus != null ? clientStatus : serverStatus);
}

var codeEditor = CodeMirror(document.getElementById("codewrapper"), {
  value: "",
  mode:  "text/x-c++src",
  theme: "base16-dark",
  lineNumbers: true,
  indentWithTabs: true,
  indentUnit: 4,
  lineWrapping: true
});

codeEditor.on("changes", function() {
	if (selectedApp == null) {
		return;
	}
	selectedApp.modified = true;
	$(selectedApp.domElement).addClass("modified");
});

function selectApp(app) {
	if (selectedApp != null) {
		$(selectedApp.domElement).removeClass("selected");
	}
	
	if (app.source.doc == null) {
		app.source.doc = CodeMirror.Doc(app.source.content, "text/x-c++src", 0);
	}
	
	codeEditor.swapDoc(app.source.doc);
	
	$(app.domElement).addClass("selected");
	selectedApp = app;
}

function createAppItem(app) {
	var sidebar = $(".sidebar")[0];
	var item = document.createElement("div");
	item.className = "appitem";
	
	var img = document.createElement("img");
	img.src = "screen/" + app.shortname + "?" + new Date().getTime();
	img.className = "appscreen";
	item.appendChild(img);
	
	var title = document.createElement("div");
	title.className = "apptitle";
	title.appendChild(document.createTextNode(app.name));
	item.appendChild(title);
	
	var shortname = document.createElement("div");
	shortname.className = "appshortname";
	shortname.appendChild(document.createTextNode(app.shortname + ".cpp"));
	item.appendChild(shortname);	
	
	sidebar.appendChild(item);
	
	$(item).click(function() {
		selectApp(app);
	});	
	$(item).dblclick(function() {
		runApp(app);
	});
	return item;
}

function updateApps(appToSelect) {
	$.ajax("apps", {
		success: function(data) {
			for (var i = 0; i < data.length; i++) {
				if (apps[data[i].shortname] == null) {
					apps[data[i].shortname] = data[i];			
					apps[data[i].shortname].domElement = createAppItem(data[i]);
					apps[data[i].shortname].modified = false;
					if (appToSelect != null && data[i].shortname == appToSelect) {
						selectApp(apps[data[i].shortname]);
					}
				}
			}
			
			if (selectedApp == null && Object.keys(apps).length != 0) {
				selectApp(apps[Object.keys(apps)[0]]);
			}			
			if (Object.keys(apps).length == 0) {
				showCreateAppForm();
			}
		}
	});
}

function runApp(app) {
	setStatus("Connecting...", false);
	setStatus(null, true);
	$.ajax("run/" + app.shortname, {
		method: "POST",
		success: function(data) {
			app.domElement.childNodes[0].src = "screen/" + app.shortname + "?" + new Date().getTime();
			showCompiler(false);
		},
		error: function(data) {
			if (data.responseJSON.compilerMessage != null) {
				setStatus("Failed to compile" + app.shortname + ".cpp.", true);
				$('#compilerText').text(data.responseJSON.compilerMessage);
				showCompiler(true);
			} else {
				setStatus("Failed to run app.", true);
			}
		}
	});
}

function handleButtonIntent(intent) {
	if (intent == "compile") {
		$('#btnCompile span').css("color", "#FFD800");
		setStatus("Compiling " + selectedApp.shortname + ".cpp...", true);	
		$.ajax("compile/" + selectedApp.shortname, {
			method: "POST",
			success: function(data) {
				setStatus(null, true);
				$('#btnCompile span').css("color", "#00CC1B");
				$('#btnCompile span').animate({color: "#C9C9C9"}, 3000);
				showCompiler(false);
			},
			error: function(data) {
				setStatus("Failed to compile" + selectedApp.shortname + ".cpp.", true);
				if (data.responseJSON.compilerMessage != null) {					
					$('#compilerText').text(data.responseJSON.compilerMessage);
					showCompiler(true);
				}
				$('#btnCompile span').css("color", "#FF0000");
				$('#btnCompile span').animate({color: "#C9C9C9"}, 3000);
			}
		});
	}
	
	if (intent == "run") {
		runApp(selectedApp);
	}
}

function saveFile(intent) {
	if (selectedApp == null) {
		return;
	}
	if (!selectedApp.modified && intent != "update") {
		handleButtonIntent(intent);
		return;
	}
	
	$('#btnUpload span').css("color", "#FFD800");
	setStatus("Uploading " + selectedApp.shortname + ".cpp...", true);
	$.ajax("save/" + selectedApp.shortname, {
		method: "POST",
		processData: false,
		data: codeEditor.getValue(),
		contentType: 'text/plain',
		success: function(data) {
			setStatus(null, true);
			$('#btnUpload span').css("color", "#00CC1B");
			$('#btnUpload span').animate({color: "#C9C9C9"}, 3000);
			selectedApp.modified = false;
			$(selectedApp.domElement).removeClass("modified");
			
			handleButtonIntent(intent);
		},
		error: function() {
			$('#btnUpload span').css("color", "#FF0000");
			$('#btnUpload span').animate({color: "#C9C9C9"}, 3000);
			setStatus("Failed to upload.", true);
		}
	});
}

function showCompiler(show) {
	$('.compiler-wrapper').effect("slide", {direction: "right", mode: show ? "show" : "hide", complete:
		function() {
			$(document.body).removeClass(show ? "nocompiler" : "compiler");
			$(document.body).addClass(show ? "compiler" : "nocompiler");
		}
	}, 200);
}

var selectedTemplate = 2;

function templateSelectorClick(event) {
	var element = event.target;
	selectedTemplate = $($(element)[0].parentNode.parentNode.children).index($(element)[0].parentNode);
	$('#btnTemplateText').text($(event.target).text());
}

function createApp(event) {
	var name = $('#inputAppName').val();
	var shortName = $('#inputShortName').val();
	$('#createAppPanel').effect("slide", {direction: "up", mode: "hide", distance: 520});
	
	$.ajax("create", {
		method: "POST",
		data: {
			template: selectedTemplate,
			name: name,
			shortName: shortName
		},
		success: function(data) {
			setStatus("Created " + shortName + ".cpp.", true);
			$('#inputAppName').val('');
			$('#inputShortName').val('');
			updateApps(shortName);
		},
		error: function(data) {
			$('#createAppPanel').effect("slide", {direction: "up", mode: "show", distance: 520});
			setStatus(data.responseText, true);
		}
	});
	
	event.preventDefault();
}

function deleteApp() {
	if (selectedApp == null) return;
	if (!confirm("Do you want to permanently delete " + selectedApp.shortname + "?")) return;
	
	$.ajax("delete/" + selectedApp.shortname, {
		method: "POST",
		success: function(data) {			
			setStatus("Deleted " + selectedApp.shortname + ".", true);
			selectedApp.domElement.parentNode.removeChild(selectedApp.domElement);
			delete apps[selectedApp.shortname];
			selectedApp = null;
			if (Object.keys(apps).length != 0) {
				selectApp(apps[Object.keys(apps)[0]]);
			} else {
				codeEditor.getDoc().setValue("");
				showCreateAppForm();
			}
		},
		error: function() {
			setStatus("Failed to delete " + selectedApp.shortname + ".", true);			
		}
	});
}

function updateStatus() {
	$.ajax("status", {
		method: "GET",
		success: function(data) {			
			setStatus(data.state, false);
			$('#fps').html(data.fps != null ? data.fps + " FPS" : "");
		},
		error: function() {
			setStatus("Lost connection to server. Retrying...", false);
		},
		complete: function() {
			setTimeout(updateStatus, 1000);
		}
	});
}

function showCreateAppForm() {
	$('#createAppPanel').effect("slide", {direction: "up", mode: "show", distance: 520});
	$('#inputAppName').focus();
}

function recordGif() {
	var gifTab = window.open(selectedApp.shortname + ".gif");
	gifTab.blur();
	window.focus();
	$.ajax("recordgif/" + selectedApp.shortname, {
		method: "POST",
		success: function(data) {			
			gifTab.location.reload();
			gifTab.focus();
		}
	});
}

$('#btnUpload').click(function() {saveFile("update");});
$('#btnCompile').click(function() {saveFile("compile");});
$('#btnRun').click(function() {saveFile("run");});
$('#btnStop').click(function() {
	$.ajax("stop", {method: "POST"});
});
$('#btnFadeout').click(function() {
	$.ajax("fadeout", {method: "POST"});
});
$('#btnCompiler').click(function() {showCompiler($(document.body).hasClass("nocompiler"));});
$('#btnHideCompiler').click(function() {showCompiler(false);});

$('#btnShowCreateApp').click(showCreateAppForm);
$('#inputAppName').on("input", function() {
	$('#inputShortName').val($('#inputAppName').val().replace(/[^a-zA-Z0-9]/g, ""));
});

$('#btnHideCreateApp').click(function() { $('#createAppPanel').effect("slide", {direction: "up", mode: "hide", distance: 520}); });
$('#createAppForm').submit(createApp);
$('#btnRecordGif').click(recordGif);
$('#btnDeleteApp').click(deleteApp);

codeEditor.setSize("100%", "100%");
codeEditor.setOption("extraKeys", {
	"Ctrl-S": saveFile,
	"Ctrl-Enter": function() {saveFile("run")},
	"Ctrl-O": function() {saveFile("run")},
	"Ctrl-K": function() {saveFile("compile")}
});

window.onbeforeunload = function(){
	var unsavedApps = [];
	for (var i = 0; i < Object.keys(apps).length; i++) {
		if (apps[Object.keys(apps)[i]].modified) {
			unsavedApps.push(apps[Object.keys(apps)[i]].name);
		}
	}
	if (unsavedApps.length > 0) {
		return "Do you want to leave this page? Changes you made will not be saved.";
	}
};

updateApps();
updateStatus();