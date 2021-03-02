// ==UserScript==
// @name        anime(bits) cover finder for AnimeBytes
// @namespace   animebits.radio.cover.animebytes
// @author      anime(bits)
// @description Allows finding new covers directly from torrent group, and other utilities to find further data
// @version     1.0.1
// @homepage    https://radio.animebits.moe
// @icon        https://radio.animebits.moe/img/icon-128.png
// @updateURL   https://radio.animebits.moe/userscript/animebytes-radio-cover.user.js
// @downloadURL https://radio.animebits.moe/userscript/animebytes-radio-cover.user.js
//
// @run-at      document-end
// @include     https://animebytes.tv/torrents2.php?*
// ==/UserScript==

function addExtraLinkToHeader(element, head){
    try{
        let e = head.getElementsByTagName("strong")[0];

        let extra = e.nextElementSibling;
        if(extra === null || extra.nodeName.toLowerCase() !== "span"){
            extra = document.createElement("span");
            e.parentNode.insertBefore(document.createTextNode(" "), e.nextSibling);
            e.parentNode.insertBefore(extra, e.nextSibling.nextSibling);
        }
        if(extra.childNodes.length > 0){
            extra.append(" | ");
        }
        extra.append(element);
        return true;
    }catch (e) {
        //No elements to add onto
        return false;
    }
}

function escapeSearchParameter(str){
    return str.replace(/(["'])/g, "\\$1");
}

function isTouhouRelated(root){
    let links = root.getElementsByTagName("a");
    for(let i = 0; i < links.length; ++i){
        let url = new URL(links[i].href, location.origin);
        if((url.hostname === "animebytes.tv" || url.hostname === "animebyt.es")){
            if(url.pathname === "/artist.php" && url.searchParams.get("id") === "945"){
                return true;
            }else if(url.pathname === "/torrents2.php" && url.searchParams.get("tags") === "touhou"){
                return true;
            }
        }
    }

    return false;
}

let pageURL = new URL(document.location);

{
    if((pageURL.hostname === "animebytes.tv" || pageURL.hostname === "animebyt.es") && pageURL.pathname === "/torrents2.php" && pageURL.searchParams.has("id")){
        try{
            let groupId = parseInt(pageURL.searchParams.get("id"));
            let sidebar = document.getElementById("content").getElementsByClassName("sidebar")[0];
            let boxes = sidebar.getElementsByClassName("box");

            let imageBox = null;
            let artistsBox = null;
            let infoBox = null;

            let mainTitle = null;
            let japaneseTitle = null;

            let catalogs = [];

            for(let i = 0; i < boxes.length; ++i){
                let box = boxes[i];
                let head = box.getElementsByClassName("head");
                if(head.length == 0){
                    continue;
                }

                if(head[0].textContent === "Album Art"){
                    imageBox = box;
                }else if(head[0].textContent === "Album Info"){
                    infoBox = box;
                    let list = box.getElementsByTagName("li");
                    for(let j = 0; j < list.length; ++j){
                        let match = list[j].textContent.replace("\n", " ").match(/(album title|japanese title):[\s]+(.+)$/i);
                        if(match !== null){
                            if(match[1].toLowerCase() === "album title"){
                                mainTitle = match[2].trim();
                            }else if(match[1].toLowerCase() === "japanese title"){
                                japaneseTitle = match[2].trim();
                            }
                        }
                    }
                }else if(head[0].textContent === "Artists"){
                    artistsBox = box;
                }
            }

            let editions = document.getElementById("content").getElementsByClassName("edition_info");

            for(let i = 0; i < editions.length; ++i){
                {
                    let match = editions[i].textContent.replace("\n", " ").match(/([^/]+)[\s]+\/[\s]+([^/]+)[\s]+\/[\s]+(.+)$/);
                    if(match !== null){
                        catalogs.push(match[2].trim())
                    }else{
                        match = editions[i].textContent.replace("\n", " ").match(/([^/]+)[\s]+\/[\s]+([^/]+)$/);
                        if(match !== null){
                            catalogs.push(match[1].trim())
                        }
                    }
                }
            }

            if(imageBox !== null){
                let imgElement = imageBox.getElementsByClassName("scaledImg")[0];
                let imgUrl = imgElement.href;

                {
                    let e = document.createElement("a");
                    e.setAttribute("href", "https://www.google.com/searchbyimage?image_url=" + encodeURIComponent(imgUrl));
                    e.setAttribute("target", "_blank");
                    e.setAttribute("title", "Open Google reverse image search");
                    e.textContent = "[G]";
                    addExtraLinkToHeader(e, imageBox.getElementsByClassName("head")[0]);
                }

                {
                    if(isTouhouRelated(sidebar) && (japaneseTitle || mainTitle)){
                        let q = [];
                        if(mainTitle){
                            q.push("\""+escapeSearchParameter(mainTitle)+"\"");
                        }
                        if(japaneseTitle){
                            q.push("\""+escapeSearchParameter(japaneseTitle)+"\"");
                        }
                        for(let i in catalogs){
                            q.push("\""+escapeSearchParameter(catalogs[i])+"\"");
                        }

                        let searchQuery = "";
                        for(let i in q){
                            if(i > 0){
                                searchQuery += " OR ";
                            }
                            searchQuery += q[i];
                        }

                        let searchUrl = "https://thwiki.cc/index.php?setlang=en&search=" + encodeURIComponent("incategory:同人专辑 (" + searchQuery + ")");

                        let e = document.createElement("a");
                        e.setAttribute("href", searchUrl);
                        e.setAttribute("target", "_blank");
                        e.setAttribute("title", "Open THBWiki search");
                        e.textContent = "[THB]";
                        addExtraLinkToHeader(e, imageBox.getElementsByClassName("head")[0]);
                    }
                }

                {
                    if(catalogs.length > 0){
                        let e = document.createElement("a");
                        e.setAttribute("href", "https://vgmdb.info/search?q=" + encodeURIComponent(catalogs[0]));
                        e.setAttribute("target", "_blank");
                        e.setAttribute("title", "Open VGMdb search");
                        e.textContent = "[VGM]";
                        addExtraLinkToHeader(e, imageBox.getElementsByClassName("head")[0]);
                    }
                }
            }
        }catch (e) {
            console.log(e)
        }
    }
}