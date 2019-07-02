window.onload = function () {
    var imgs = document.querySelectorAll('img');
    function getTop(e) {
        var t = e.offsetTop;
        while(e = e.offsetParent) {
            t += e.offsetTop;
        }
        return t;
    }

    function lazyload(imgs) {
        var h = window.innerHeight;
        var s = document.documentElement.scrollTop || document.body.scrollTop;
        for (var i = 0; i < imgs.length; i++) {
            if ((h + s) > getTop(imgs[i])) {
                (function (i) {
                    setTimeout(function () {
                        // console.log(i);
                        // 隐式加载图片或资源
                        var tmp = new Image();
                        tmp.src = imgs[i].getAttribute('data-src');
                        tmp.onload = function () {
                            imgs[i].src = imgs[i].getAttribute('data-src');
                        }
                    }, 1000)
                })(i)
            }
        }
    }
    lazyload(imgs);
    window.onscroll = function () {
        lazyload(imgs)
    }
}