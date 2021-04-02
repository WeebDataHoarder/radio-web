// ==UserScript==
// @name        anime(bits) extension for AnimeBytes
// @namespace   animebits.radio.extension.animebytes
// @author      anime(bits)
// @description Adds group radio links on AnimeBytes to artists, series, collages listings, and direct links to each torrent group on related lists as well.
// @version     1.5.0
// @homepage    https://radio.animebits.moe
// @icon        https://radio.animebits.moe/img/icon-128.png
// @updateURL   https://radio.animebits.moe/userscript/animebytes-radio-extensions.user.js
// @downloadURL https://radio.animebits.moe/userscript/animebytes-radio-extensions.user.js
//
// @run-at      document-end
// @include     https://animebytes.tv/torrents2.php*
// @include     https://animebytes.tv/artist.php?*
// @include     https://animebytes.tv/collage.php?*
// @include     https://animebytes.tv/series.php?*
// @include     https://animebytes.tv/torrents.php?*
// @include     https://animebytes.tv/forums.php?*
// ==/UserScript==


function createIconElement(){
    let icon = document.createElement("img");
    icon.src = "data:image/png;base64,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";
    icon.alt = "\uD83D\uDCFB";
    icon.style.height = "1.5em";
    icon.style.width = "1.5em";
    icon.style["vertical-align"] = "middle";
    icon.referrerpolicy = "no-referrer";
    return icon;
}

function addToGroupExtraLinks(element){
    try{
        let thinElement = document.getElementById("content").getElementsByClassName("thin")[0];
        let h2 = thinElement.getElementsByTagName("h2")[0];

        let h3 = h2.nextElementSibling;
        if(h3.nodeName.toLowerCase() !== "h3"){
            h3 = document.createElement("h3");
            h2.parentNode.insertBefore(h3, h2.nextSibling);
        }
        if(h3.childNodes.length > 0){
            h3.append(" | ");
        }
        h3.append(element);
        return true;
    }catch (e) {
        //No elements to add onto
        return false;
    }
}

function addToListRadioLinks(groupList, allowSingleTorrents = false, inline = false){
    for(let i = 0; i < groupList.length; ++i){
        try{
            let list = groupList[i].getElementsByTagName("a");
            for(let j = 0; j < list.length; ++j){
                let link = new URL(list[j].href, document.location.origin);
                if((allowSingleTorrents || !link.searchParams.has("torrentid")) && list[j].getElementsByTagName("img").length === 0){
                   let extraElement = getGroupRadioLink(link);
                   if(extraElement !== null){
                       if(inline){
                           list[j].parentNode.insertBefore(document.createTextNode(" "), list[j].nextSibling);
                           list[j].parentNode.insertBefore(extraElement, list[j].nextSibling.nextSibling);
                       }else{
                           list[j].parentNode.append(" ");
                           list[j].parentNode.append(extraElement);
                       }
                   }
                }
            }
        }catch (e) {
            //No elements to add into
        }
    }
}

function getGroupRadioLink(url){
    if((url.hostname === "animebytes.tv" || url.hostname === "animebyt.es") && url.pathname === "/torrents2.php" && url.searchParams.has("id")){
        const e = document.createElement("a");
        if(url.searchParams.has("torrentid")){
            const id = url.searchParams.get("torrentid");
            const groupId = url.searchParams.get("id");
            e.setAttribute("href", "https://radio.animebits.moe/player/abt/" + parseInt(id) + "/abg/" + parseInt(groupId));
            e.setAttribute("rel", "noopener");
            e.setAttribute("title", "Open anime(bits) release player");
            e.appendChild(createIconElement());
            return e;
        }else{
            const id = url.searchParams.get("id");
            e.setAttribute("href", "https://radio.animebits.moe/player/abg/" + parseInt(id));
            e.setAttribute("rel", "noopener");
            e.setAttribute("title", "Open anime(bits) group player");
            e.appendChild(createIconElement());
            return e;
        }
    }
    return null;
}
function extraEncodeURIComponent(str) {
    return encodeURIComponent(str).replace(/[\(\)]/g, function(c) {
        return '%' + c.charCodeAt(0).toString(16);
    });
}
function escapeSearchParameter(str){
    return str.replace(/(["'])/g, "\\$1");
}
function getSearchRadioLink(searchQueries){
    const e = document.createElement("a");
    let searchQuery = "";
    for(let i in searchQueries){
        if(i > 0){
            searchQuery += "/";
        }
        searchQuery += extraEncodeURIComponent(searchQueries[i]);
    }
    e.setAttribute("href", "https://radio.animebits.moe/player/search/" + searchQuery);
    e.setAttribute("rel", "noopener");
    e.setAttribute("title", "Open anime(bits) search player for: "+searchQuery);
    e.appendChild(document.createTextNode("[search "));
    e.appendChild(createIconElement());
    e.appendChild(document.createTextNode("]"));
    return e;
}
function reverseWords(str){
    let words = str.split(" ").reverse();
    let reverse = "";
    for(let w in words){
        reverse += (w > 0 ? " " : "") + words[w];
    }

    return reverse;
}


let pageURL = new URL(document.location);

{

    let baseElement = getGroupRadioLink(pageURL);
    if(baseElement !== null){
        addToGroupExtraLinks(baseElement);
    }
}

{
    if(pageURL.pathname === "/collage.php"){
        {
            addToListRadioLinks(document.getElementById("content").getElementsByClassName("discog"), false);
        }
    }
}

{
    if(pageURL.pathname === "/series.php" && pageURL.searchParams.has("id")){
        {
            const e = document.createElement("a");
            const id = pageURL.searchParams.get("id");
            e.setAttribute("href", "https://radio.animebits.moe/player/abs/" + parseInt(id));
            e.setAttribute("rel", "noopener");
            e.setAttribute("title", "Open anime(bits) series player");
            e.appendChild(createIconElement());
            addToGroupExtraLinks(e);
        }

        {
            addToListRadioLinks(document.getElementById("content").getElementsByClassName("discog"), false);
        }
    }
}

{
    if(pageURL.pathname === "/artist.php" && pageURL.searchParams.has("id")){
        let mainArtist = "";
        let secondaryArtist = "";
        {
            let h2 = document.getElementById("content").getElementsByTagName("h2")[0];
            mainArtist = h2.textContent;
            secondaryArtist = h2.nextElementSibling.nodeName.toLowerCase() === "h3" ? h2.nextElementSibling.textContent : "";
        }

        {
            const e = document.createElement("a");
            const id = pageURL.searchParams.get("id");
            e.setAttribute("href", "https://radio.animebits.moe/player/aba/" + parseInt(id));
            e.setAttribute("rel", "noopener");
            e.setAttribute("title", "Open anime(bits) artist player");
            e.appendChild(createIconElement());
            addToGroupExtraLinks(e);
        }

        {
            addToListRadioLinks(document.getElementById("content").getElementsByClassName("discog"), false);
        }

        {
            let query = "artist='"+escapeSearchParameter(mainArtist)+"'";
            if(reverseWords(mainArtist) !== mainArtist){
                query += "OR artist='"+escapeSearchParameter(reverseWords(mainArtist))+"'";
            }
            if(secondaryArtist !== ""){
                query += " OR artist=\'"+escapeSearchParameter(secondaryArtist)+"\'";
                if(reverseWords(secondaryArtist) !== secondaryArtist){
                    query += " OR artist=\'"+escapeSearchParameter(reverseWords(secondaryArtist))+"\'";
                }
            }
            let e = getSearchRadioLink([query]);
            addToGroupExtraLinks(e);
        }

    }
}

{
    if(pageURL.pathname === "/torrents.php" && pageURL.searchParams.has("id")){
        {
            try{
                let list = document.getElementById("song_table").getElementsByTagName("tr");
                for(let i = 0; i < list.length; ++i){
                    if(list[i].className !== "column_head"){
                        let elements = list[i].getElementsByTagName("td");

                        let exactArtist = null;
                        let artists = [];
                        for(let j = 0; j < elements[2].childNodes.length; ++j){
                            if(elements[2].childNodes[j].nodeName === "#text"){
                                let a_l = elements[2].childNodes[j].textContent.split(",");
                                for(let a in a_l){
                                    if(a_l[a].trim() !== ""){
                                        artists.push(a_l[a].trim());
                                    }
                                }
                            }else if(elements[2].childNodes[j].nodeName.toLowerCase() === "a"){
                                artists.push(elements[2].childNodes[j].textContent.trim());
                                let url = (new URL(elements[2].childNodes[j].href, location.origin));
                                if(url.pathname === "/artist.php"){
                                    exactArtist = parseInt(url.searchParams.get("id"));
                                }
                            }
                        }

                        let titles = [];
                        for(let j = 0; j < elements[1].childNodes.length; ++j){
                            if(elements[1].childNodes[j].nodeName === "#text" && elements[1].childNodes[j].textContent.trim() !== ""){
                                titles.push(elements[1].childNodes[j].textContent.trim());
                            }
                        }

                        let titleQuery = "";
                        let artistQuery = "";

                        let titleFuzzyQuery = "";
                        let artistFuzzyQuery = "";

                        for(let j in titles){
                            titleQuery += (j == 0 ? "" : " OR ") + "title=\'"+escapeSearchParameter(titles[j])+"\'";
                            titleFuzzyQuery += (j == 0 ? "" : " OR ") + "title~\'"+escapeSearchParameter(titles[j])+"\'";
                        }

                        titleQuery = "("+titleQuery+")";
                        titleFuzzyQuery = "("+titleFuzzyQuery+")";

                        if(artists.length > 0){
                            for(let j in artists){
                                artistQuery += (j == 0 ? "" : " OR ") + "artist=\'"+escapeSearchParameter(artists[j])+"\'";
                                artistFuzzyQuery += (j == 0 ? "" : " OR ") + "artist~\'"+escapeSearchParameter(artists[j])+"\'";
                                if(reverseWords(artists[j]) !== artists[j]){
                                    artistQuery += " OR artist=\'"+escapeSearchParameter(reverseWords(artists[j]))+"\'";
                                    artistFuzzyQuery += " OR artist~\'"+escapeSearchParameter(reverseWords(artists[j]))+"\'";
                                }
                            }

                            artistQuery = "("+artistQuery+")";
                            artistFuzzyQuery = "("+artistFuzzyQuery+")";
                        }


                        let q = [];

                        {
                            if(exactArtist !== null){
                                q.push("(" + titleQuery + " AND tag:aba-" + exactArtist + " AND path=\'%.flac\')");
                            }

                            if(artistQuery !== ""){
                                q.push("("+titleQuery+" AND "+artistQuery+" AND path=\'%.flac\')");
                            }else{
                                q.push("("+titleQuery+" AND path=\'%.flac\')");
                            }
                        }

                        {
                            if(exactArtist !== null){
                                q.push("(" + titleQuery + " AND tag:aba-" + exactArtist + ")");
                            }

                            if(artistQuery !== ""){
                                q.push("("+titleQuery+" AND "+artistQuery+")");
                            }else{
                                q.push("("+titleQuery+")");
                            }
                        }

                        {
                            if(exactArtist !== null){
                                q.push("(" + titleFuzzyQuery + " AND tag:aba-" + exactArtist + ")");
                            }

                            if(artistQuery !== ""){
                                q.push("("+titleQuery+" AND "+artistFuzzyQuery+")");
                                q.push("("+titleFuzzyQuery+" AND "+artistQuery+")");
                                q.push("("+titleFuzzyQuery+" AND "+artistFuzzyQuery+")");
                            }else{
                                q.push("("+titleFuzzyQuery+")");
                            }
                        }

                        let e = getSearchRadioLink(q);
                        let br = document.createElement("br");
                        elements[1].insertBefore(br, elements[1][elements[1].childNodes.length - 1]);
                        elements[1].insertBefore(e, elements[1][elements[1].childNodes.length - 1]);
                    }
                }
            }catch (e) {

            }
        }
    }
}

{
    if(pageURL.pathname === "/torrents2.php" && !pageURL.searchParams.has("id")){
        {
            addToListRadioLinks(document.getElementById("content").getElementsByClassName("group_cont"), false);
        }
    }
}

{
    if(pageURL.pathname === "/forums.php" && pageURL.searchParams.get("action") === "viewthread" && pageURL.searchParams.has("threadid")){
        {
            addToListRadioLinks(document.getElementById("content").getElementsByClassName("post_block"), true, true);
        }
    }
}