

function htmlentities(rawStr) {
    return String(rawStr).replace(/[\u00A0-\u9999<>\&]/gim, function (i) {
        return '&#' + i.charCodeAt(0) + ';';
    });
}


function getCatalogNumberSearchLink(catalog, tags){
    //alternate, sometimes either of them has it and the other does not: let targetSearch = "https://www.discogs.com/search/?type=release&catno=" + encodeURIComponent(catalog);
    let targetSearch = "https://musicbrainz.org/search?advanced=1&type=release&query=" + encodeURIComponent("catno:" + catalog);
    if (tags.includes('touhou')) {
        targetSearch = "https://thwiki.cc/index.php?setlang=en&search=" + encodeURIComponent("incategory:同人专辑 (" + catalog + ")");
    } else if (tags.includes('soundtrack') || tags.includes('doujin') || tags.includes('remix') || tags.includes('op') || tags.includes('ed')) {
        targetSearch = "https://vgmdb.info/search?q=" + encodeURIComponent(catalog);
    } else if (tags.includes('vocaloid')) {
        targetSearch = "https://vocadb.net/Search?searchType=Album&filter=" + encodeURIComponent(catalog);
    } else if (tags.includes('eurobeat')) {
        targetSearch = "http://www.dancegroove.net/database/search.php?mode=cd&catalog=" + encodeURIComponent(catalog);
    }

    return targetSearch;
}

function getTagEntries(song){
    let tags = [];
    let meta = {};

    if ("tags" in song) {
        let groupId = null;
        let torrentId = null;
        let linkType = null;


        let catalog = null;

        let miscTags = [];
        let miscPriority = 100;
        let allowedMiscTags = {
            aotw: 1,
            op: 1,
            ed: 1
        };


        let classTags = [];
        let classPriority = 100;
        let allowedClassTags = {
            touhou: 1,
            vocaloid: 1,
            eurobeat: 1,
            symphogear: 3,
            soundtrack: 2,
            remix: 3,
            doujin: 4,
            drama: 4
        };


        let genreTags = [];
        let genrePriority = 100;
        let allowedGenreTags = {
            alternative: 1,
            house: 1,
            dance: 1,
            trance: 1,
            ambient: 1,
            electronic: 2,
            funk: 1,
            gothic: 1,
            jazz: 1,
            metal: 1,
            pop: 2,
            rock: 1,
            "hip.hop": 1,
            vocal: 1
        };

        song.tags.forEach((tag) => {
            let matches = null;
            if ((matches = tag.match(/^(jps|ab|red|bbt)([gt])-([0-9]+)$/i)) !== null) {
                if (matches[2] === "g") {
                    groupId = matches[3];
                } else if (matches[2] === "t") {
                    torrentId = matches[3];
                }
                linkType = matches[1];
            } else if ((matches = tag.match(/^catalog-(.+)$/i)) !== null) {
                catalog = matches[1].toUpperCase();
            } else if (tag in allowedMiscTags) {
                if (allowedMiscTags[tag] === miscPriority) {
                    miscPriority = allowedMiscTags[tag];
                    miscTags.push(tag);
                } else if (allowedMiscTags[tag] < miscPriority) {
                    miscPriority = allowedMiscTags[tag];
                    miscTags = [];
                    miscTags.push(tag);
                }
            } else if (tag in allowedClassTags) {
                if (allowedClassTags[tag] === classPriority) {
                    classPriority = allowedClassTags[tag];
                    classTags.push(tag);
                } else if (allowedClassTags[tag] < classPriority) {
                    classPriority = allowedClassTags[tag];
                    classTags = [];
                    classTags.push(tag);
                }
            } else if (tag in allowedGenreTags) {
                if (allowedGenreTags[tag] === genrePriority) {
                    genrePriority = allowedGenreTags[tag];
                    genreTags.push(tag);
                } else if (allowedGenreTags[tag] < genrePriority) {
                    genrePriority = allowedGenreTags[tag];
                    genreTags = [];
                    genreTags.push(tag);
                }
            }
        });


        if (catalog !== null) {
            tags.push({
                classes: ["tag-catalog-" + catalog],
                text: catalog,
                link: getCatalogNumberSearchLink(catalog, song.tags)
            });
        }

        classTags.forEach((t) => {
            tags.push({
                classes: ["tag-" + t.replace(".", "-")],
                text: t
            });
        });

        genreTags.forEach((t) => {
            tags.push({
                classes: ["tag-" + t.replace(".", "-")],
                text: t
            });
        });

        miscTags.forEach((t) => {
            tags.push({
                classes: ["tag-" + t.replace(".", "-")],
                text: t
            });
        });

        if (groupId !== null && torrentId !== null && (linkType === "ab" || linkType === "jps" || linkType === "red" || linkType === "bbt")) {
            meta["dl-link-type"] = linkType;
            if (linkType === "ab") {
                meta["dl-link-href"] = "https://animebytes.tv/torrents2.php?id=" + groupId + "&torrentid=" + torrentId;
            } else if (linkType === "jps") {
                meta["dl-link-href"] = "https://jpopsuki.eu/torrents.php?id=" + groupId + "&torrentid=" + torrentId;
            } else if (linkType === "red") {
                meta["dl-link-href"] = "https://redacted.ch/torrents.php?id=" + groupId + "&torrentid=" + torrentId;
            } else if (linkType === "bbt") {
                meta["dl-link-href"] = "https://bakabt.me/torrent/" + torrentId + "/show";
            }
        } else {
            if (song.hash) {
                meta["dl-link-href"] = baseApiUrl + "/api/download/" + song.hash;
            }
        }
    }

    return {
        tags: tags,
        meta: meta
    }
}

function applyTagEntries(element, tagEntries){
    tagEntries.forEach((tag) => {
        let newTag = document.createElement("link" in tag ? "a" : "div");
        newTag.classList.add("tag");
        tag.classes.forEach((c) => {
            newTag.classList.add(c);
        });
        newTag.innerText = tag.text;
        if("link" in tag){
            newTag.href = tag.link;
            newTag.setAttribute("target", "_blank");
        }
        element.appendChild(newTag);
    });
}

function pushPlayNotification(song, context){
    if ("Notification" in window) {
        if (window.localStorage.getItem("radio-notifications") === "on" && Notification.permission === "granted") {
            var n = new Notification(song.title, {
                icon: (song["cover"] !== null ? "/api/cover/" + song["cover"] + "/small" : "/img/no-cover.jpg"),
                image: (song["cover"] !== null ? "/api/cover/" + song["cover"] + "/large" : "/img/no-cover.jpg"),
                body: "by " + song.artist + " from " + song.album,
                silent: true,
                requireInteraction: false,
                tag: context + "." + window.location.hostname
            });
            n.onclick = function () {
                window.focus();
            };
            setTimeout(n.close.bind(n), 5000);
        }
    }
}

function pushMediaSessionMetadata(song){
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song["title"],
            artist: song["artist"],
            album: song["album"],
            artwork: [
                {
                    src: location.protocol + '//' + document.domain + ':' + location.port + (song["cover"] !== null ? "/api/cover/" + song["cover"] + "/large" : "/img/no-cover.jpg"),
                    sizes: '800x800',
                    type: 'image/jpeg'
                },
                {
                    src: location.protocol + '//' + document.domain + ':' + location.port + (song["cover"] !== null ? "/api/cover/" + song["cover"] + "/small" : "/img/no-cover.jpg"),
                    sizes: '55x55',
                    type: 'image/jpeg'
                }
            ]
        });
    }
}