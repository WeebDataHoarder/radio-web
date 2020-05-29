<?php
require_once("common.php");

header("Link: </css/foundation.min.css?".VERSION_HASH.">; rel=preload; as=style", false);
header("Link: </css/app.css".VERSION_HASH."; rel=preload; as=style", false);
header("Link: </js/jquery.js".VERSION_HASH."; rel=preload; as=script", false);
header("Link: </js/player/aurora.js".VERSION_HASH."; rel=preload; as=script", false);
header("Link: </js/player/player.js".VERSION_HASH."; rel=preload; as=script", false);
header("Link: </js/cookies.js".VERSION_HASH."; rel=preload; as=script", false);
header("Link: </js/main.js".VERSION_HASH."; rel=preload; as=script", false);
header("Link: </js/stream.js".VERSION_HASH."; rel=preload; as=script", false);
header("Link: </js/functions.js".VERSION_HASH."; rel=preload; as=script", false);

?>
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>anime(bits) #radio</title>

	<meta property="og:site_name" content="anime(bits) #radio">
	<meta property="og:type" content="music.radio_station">
	<meta property="og:rich_attachment" content="true">
	<meta property="og:description" content="anime(bits) #radio - all them beats, live">
	<meta property="og:audio" content="https://<?php echo SITE_HOSTNAME; ?>/stream/stream192.mp3">
	<meta property="og:audio:type" content="audio/vnd.facebook.bridge">
	<meta property="og:audio" content="https://<?php echo SITE_HOSTNAME; ?>/stream/stream192.mp3">
	<meta property="og:audio:type" content="audio/mpeg;codec=mp3">
	<meta property="og:audio" content="https://<?php echo SITE_HOSTNAME; ?>/stream/stream128.ogg">
	<meta property="og:audio:type" content="audio/ogg;codec=opus">
	<meta property="og:audio" content="https://<?php echo SITE_HOSTNAME; ?>/stream/stream128.aac">
	<meta property="og:audio:type" content="audio/aac">
	<meta name="description" content="anime(bits) #radio - all them beats, live">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="referrer" content="no-referrer">
	<meta http-equiv="X-UA-Compatible" content="IE=edge" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="mobile-web-app-title" content="anime(bits)" />
	<meta name="google" content="notranslate" />

	<link rel="icon" sizes="128x128" href="/img/icon-128.png">
	<link rel="icon" sizes="192x192" href="/img/icon-192.png">
	<link rel="icon" sizes="256x256" href="/img/icon-256.png">
	<link rel="icon" sizes="512x512" href="/img/icon-512.png">

	<link rel="apple-touch-icon" sizes="128x128" href="/img/icon-128.png">
	<link rel="apple-touch-icon" sizes="192x192" href="/img/icon-192.png">
	<link rel="apple-touch-icon" sizes="256x256" href="/img/icon-256.png">
	<link rel="apple-touch-icon" sizes="512x512" href="/img/icon-512.png">

	<meta name="msapplication-square128x128logo" content="/img/icon-128.png">
	<meta name="msapplication-square192x192logo" content="/img/icon-192.png">
	<meta name="msapplication-square256x256logo" content="/img/icon-256.png">
	<meta name="msapplication-square512x512logo" content="/img/icon-512.png">

	<meta name="theme-color" content="#ed106a">

	<link rel="manifest" href="/manifest.webmanifest?<?php echo VERSION_HASH; ?>">
	<link rel="stylesheet" type="text/css" href="/css/foundation.min.css?<?php echo VERSION_HASH; ?>"/>
	<link rel="stylesheet" type="text/css" href="/css/app.css?<?php echo VERSION_HASH; ?>"/>

	<link rel="search" type="application/opensearchdescription+xml" title="anime(bits)" href="/search.xml"/>
	<link rel="search" type="application/opensearchdescription+xml" title="anime(bits) Album" href="/search-album.xml"/>
	<link rel="search" type="application/opensearchdescription+xml" title="anime(bits) Artist" href="/search-artist.xml"/>
</head>
<body>
	<div class="grid-x" id="blue-playlist-container">
		<div class="large-12 medium-12 small-12 cell non-auth" id="title-bar">
			<img src="/img/title.svg" id="radio-title" />
			<div id="user-login">
				<label>Identify
					<input id="api-key" name="apikey" autocomplete="on" type="text" placeholder='API key (needs miku access)' />
				</label>
			</div>
			<p class="user-feature title-menu">
				Identified as @<a href="#" target="_blank" id="current-nick"></a>
			</p>
		</div>
		<div class="large-12 medium-12 small-12 large-centered medium-centered small-centered cell non-auth" id="radio-player">
			<div class="grid-x">
				<div class="large-6 medium-6 small-12 cell" id="radio-left">
					<div class="hash-area np-hash user-feature" id="np-hash-cover"></div>
                    <div class="tag-area" id="np-tags"></div>
					<img class="np-image main-cover" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII="/>
					<div id="player-left-bottom">
						<div id="time-container">
							<span class="current-time">
								<span class="radio-current-minutes np-minutes"></span>:<span class="radio-current-seconds np-seconds"></span>
							</span>
							<div id="progress-container">
								<progress id="song-played-progress" class="radio-song-played-progress"></progress>
							</div>
							<span class="duration">
								<span class="radio-duration-minutes np-duration-minutes"></span>:<span class="radio-duration-seconds np-duration-seconds"></span>
							</span>
						</div>

						<div id="control-container">
							<div id="repeat-container" class="user-feature">
								<a id="np-player" target="_blank"></a>
								<a id="np-download" target="_blank"></a>
							</div>

							<div id="central-control-container">
								<div id="central-controls">
									<div class="song-favorite user-feature" id="radio-favorite"></div>
									<div class="play-pause hidden" id="play-pause"></div>
									<div id="radio-skip" class="user-feature"></div>
								</div>
							</div>

							<div id="volume-container">
								<div class="volume-controls">
									<div class="mute radio-not-muted"></div>
									<input type="range" class="volume-slider" value="100"/>
									<div class="ms-range-fix"></div>
								</div>
							</div>
						</div>



						<div id="meta-container">
							<span class="np-song song-name"></span>

							<div class="song-artist-album">
								<span class="np-artist"></span>
								<span class="np-album"></span>
							</div>
						</div>
					</div>
				</div>
				<div class="large-6 medium-6 small-12 cell" id="radio-right">
					<div id="radio-settings">
						<div class="grid-x settings-grid">
							<div class="large-6 medium-12 small-12 large-centered medium-centered small-centered cell settings-cell">
								<label>Stream Quality
									<select id="radio-quality">
										<optgroup id="radio-quality-group-lossless" label="Lossless Quality">
										</optgroup>
										<optgroup id="radio-quality-group-high" label="High Quality">
										</optgroup>
										<optgroup id="radio-quality-group-medium" label="Medium Quality">
										</optgroup>
										<optgroup id="radio-quality-group-low" label="Low Quality">
										</optgroup>
									</select>
								</label>
								<small style="display: inline-block;">Join #radio @ AnimeBytes for more controls. <a href="/help.html" target="_blank">Help & Documentation here</a>.</small>
                                <noscript><b>You have JavaScript disabled. <a href="/noscript.html">Here is a simple, feature-less player for you.</a></b></noscript>
								<span id="install-webapp" class="button hidden">Obtain Web App</span>
							</div>
							<div class="large-6 medium-12 small-12 large-centered medium-centered small-centered cell settings-cell">
								<p id="listeners" style="font-size: smaller;">Listeners: loading...
								</p>
								<p>
									<label id="notify-check-group">
										<input type="checkbox" id="notify-check">
										<span class="checkable">Enable "Now Playing" notifications</span>
									</label>
								</p>
								<p class="user-feature">
									<small style="display: inline-block;">You can now <a href="/import" target="_blank">Import your favorites</a> easily.</small>
								</p>
							</div>

							<div class="large-12 medium-12 small-12 large-centered medium-centered small-centered cell settings-cell" style="display: none;">
								<p id="streams-lossless" class="stream-links">

								</p>
								<p id="streams-high" class="stream-links">

								</p>
								<p id="streams-medium" class="stream-links">

								</p>
								<p id="streams-low" class="stream-links">

								</p>
							</div>



							<div class="large-12 medium-12 small-12 large-centered medium-centered small-centered cell settings-cell user-feature">
								<select id="search-type" style="display: block; float: left; width: 30%;">
									<option value="title">Track name</option>
									<option value="album">Album name</option>
									<option value="artist">Artist name</option>
									<option value="raw" selected>Full Search</option>
									<option class="user-feature" value="favorites">My favorites</option>
									<option value="history">Play history</option>
								</select>
								<div id="search-queryrandom" class="button hollow" style="display: block; float: right; width: 6%; height: 2.4375rem; margin-left: 10px; padding: 2px;"/><img src="/img/shuffle-on.svg" style="height: 30px; vertical-align: middle;"/></div>
								<input id="search-query" autocomplete="off" type="search" placeholder='Search query' style="display: block; float: right; width: 60%;"/>

							</div>
						</div>
					</div>

					<div id="search-results" class="user-feature">

					</div>

					<div id="np-queue">
						<div class="song radio-song-container">
							<img class="queue-cover np-image"/>
							<div class="song-now-playing-icon-container">
								<div class="play-button-container">

								</div>
								<img class="now-playing" src="/img/now-playing.svg"/>
							</div>
							<div class="song-meta-data">
								<span class="np-song song-title"></span>
								<span class="np-artist song-artist"></span>
								<span class="np-album song-album"></span>
							</div>
							<span class="song-duration">now</span>
						</div>
					</div>

					<div id="radio-queue">

					</div>
				</div>
			</div>
		</div>
	</div>
</body>
<script type="text/javascript" src="/js/jquery.js?<?php echo VERSION_HASH; ?>" nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" src="/js/player/aurora.js?<?php echo VERSION_HASH; ?>" nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" src="/js/player/player.js?<?php echo VERSION_HASH; ?>" nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" src="/js/cookies.js?<?php echo VERSION_HASH; ?>" nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" src="/js/functions.js?<?php echo VERSION_HASH; ?>" nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" src="/js/stream.js?<?php echo VERSION_HASH; ?>" nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" src="/js/main.js?<?php echo VERSION_HASH; ?>" nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" nonce="<?php echo SCRIPT_NONCE; ?>">

	if ('serviceWorker' in navigator) {

		if(true /*window.localStorage.getItem("radio-skip-worker") === "yes" || navigator.userAgent.indexOf("iPhone") > -1 || navigator.userAgent.indexOf("iPad") > -1 || navigator.userAgent.indexOf("Firefox/") > -1*/){
			navigator.serviceWorker.getRegistrations().then(function(registrations) {
				for(let registration of registrations) {
				 registration.unregister();
				}
			});
		}else{
			window.addEventListener('load', function() {
				navigator.serviceWorker.register('/worker.js?<?php echo VERSION_HASH; ?>').then(function(registration) {
					console.log('registered service worker');
					registration.update();
				}, function(err) {
					console.log('registration failed: ', err);
				});
			});
		}
	}
</script>

</html>
