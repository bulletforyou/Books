window.onload = function () {
    new Vue({
        data() {
            return {
                el: "#app",
                pageNo: 0,
                pageSize: 10,
                url: "http://127.0.0.1:3000/news/page/",
                data: [],
                isLoading: false,
                endOfScreen: false
            };
        },
        created() {
            this.loadingDate(this.pageNo, this.pageSize);
            var that = this;
            window.onscroll = function () {
                that.endOfScreen = that.scrollCheck();
            };
        },
        watch: {
            endOfScreen(newValue) {
                if (newValue) {
                    console.log("endOfScreen");
                    this.pageNo++;
                    this.loadingDate(this.pageNo, this.pageSize);
                }
            }
        },
        methods: {
            scrollCheck() {
                var winHeight = window.screenY + window.innerHeight;
                // console.log(winHeight = document.documentElement.offsetHeight);
                return (winHeight = document.documentElement.offsetHeight);
            },
            loadingDate(pageNo, pageSize) {
                this.isLoading = true;
                setTimeout(() => {
                    fetch(this.url + pageNo + "/" + pageSize)
                        .then(res => {
                            // console.log(res)
                            return res.json();
                        })
                        .then(res => {
                            // console.log(res)
                            for (let i in res.data) {
                                this.data.push(res.data[i]);
                            }
                            this.isLoading = false;
                        });
                }, 200);
            }
        }
    });
};
