# [移动App兼容性测试工具Spider](https://tech.meituan.com/2016/10/21/spider.html)

美团·大众点评公司旗下的多款App拥有大量的用户，App测试的过程中需要考虑到不同机型、系统、分辨率的兼容性，同样一个功能要在不同的机型测试。 为了加快整个测试流程，提高兼容性测试效率对我们来说就变得尤为重要。

这次分享的主要内容包括以下3个部分：

1. Spider功能介绍；
2. 介绍相关背景；
3. Spider功能实现。

1. 同时查看、修改、共享多台设备API接口数据；
2. 接口测试数据存储和回放；
3. 同时操作多台设备。

回放测试数据并跳转![Alt text](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2016/2c4e9295.gif)

Alt text



多设备兼容性测试![Alt text](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2016/2da30a69.png)

Alt text



移动App的测试经常要对同样一个页面，不同逻辑的页面展示和功能进行测试。一般会通过MOCK API接口返回不同的数据，去测试页面的多种样式的展示；为了覆盖到所有样式的逻辑组合，需要花较多时间去准备测试数据。

![Alt text](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2016/e69f8e44.png)

Alt text



上面的三个页面，其实是同一个页面（购买结果页），根据API回传的数据不同，展示不一样的样式和提示文案。这种情况如果不借助工具的话，手工测试会比较麻烦，需要真实购买测试团购单，然后通过修改数据库状态字段模拟购买结果的三种不同状态，这样测一个页面的展示就要花很长的时间。 使用Spider的固化数据功能，在1分钟之内就可以完成购买结果页多种不同状态的展示测试。

![Alt text](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2016/ba8ca939.png)

Alt text



首先，App的请求流程如上图所示，移动App把请求发送给Web层的API Server，API Server再去调用服务端各个应用获取数据，并整合之后返回给App，这个时候App才能展示正常的数据。这时如果需要制造或者修改测试数据的话，我们可能要深入到最后一层去修改，需要了解服务端各个应用的调用逻辑和对应的DB读写，增加了测试App的时间成本。如果测试会有数据库写操作的，数据测试一次之后就变更了，下次还得继续改，非常耗时。

![Alt text](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2016/3ef7a1e6.png)

Alt text



这个时候在App和API中间加一层“Spider请求处理模块”来操作App的数据。App先发请求到Spider，Spider来判断这个请求是否继续往后面走，如果需要返回固化测试数据，则直接将准备好的测试数据序列化之后发送给App。如果不需要返回固化测试数据，Spider会把请求原封不动的转发给API，并将从API的返回结果返回给App。

![Alt text](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2016/95058449.png)

Alt text



给大家看一下点评App的列表页，每一个商户标题右侧的小标签都由API接口的某个字段代表，像这么多的情况记的话真的是很难，而且一个个把数据整合起来也是非常花时间的。像这样一个页面，以前列表页的测试可能要需要两三个小时，每一次发版前需要做回归测试的时候，数据到底哪个代表什么可能不太记得了。这时使用Spider储存的测试接口数据，直接点击一下页面就能跳转并返回特定的测试数据了。

Spider的优势在于可以一次同时查看修改设备数据和操作设备，从而节省QA的测试时间，提高测试效率。

一个用户能同时测试多台移动设备，不论设备系统、版本或分辨率，设备数理论上没有上限。![Alt text](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2016/17284e9d.png)

Alt text



可以随时连接测试和查看、修改设备的请求数据。![Alt text](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2016/469c345e.jpeg)

Alt text



下面介绍下Spider实现：Spider主要有两个功能模块，一块控制App跳转到某个页面，还有一块处理App发出的本来应该发送到服务器的那些API请求，由Spider做一下中转。 首先App肯定是需要做一些代码改造，在APP Debug面板打开测试开关之后，所有的App发送到服务器的请求，都会发送到Spider。比如说发送到点评.com域名全部是Spider的域名，由Spider决定是不是继续往后台去发。![Alt text](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2016/a816f6c8.png)

Alt text



然后App需要另起一个线程，轮询调取Spider的心跳接口，并告知Spider测试设备的一些基本信息，以便Spider控制测试设备去做URLScheme的跳转。 具体来说，URLScheme的跳转都是通过这个流程来实现的，首先App发起心跳请求后，把基本的设备信息告诉给Spider，Spider拿到之后，就会在设备池里面添加一个新的设备，这个时候请求就先挂起在Spider上面，不会返回，这样能够节省网络开销。Spider拿到这个请求之后，分析出来有新的测试设备连接，这个时候会通知连接的所有前端“某个设备上线了”，用户可以在设备池里面看到这台设备的状态。 如果要使用某台测试设备测试固化数据的展示或者页面的跳转，首先在前端上面勾选这台测试设备，这时Spider会把这个设备跟前端建立一个映射关系。之后在前端上面做跳转的操作或者MOCK的操作，都能找到对应的设备。

![Alt text](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2016/ded4e0f3.png)

Alt text



关于持续集成和移动自动化，其实Spider还能做很多的事情，比如说能够通过接口控制设备的数据固化、设备的跳转、获取设备请求详细信息。 平时做移动App自动化测试的时候，比较困扰的一个问题是：同一套自动化测试脚本调试时可以跑通，但因为测试数据总是会变化（可能测试团单下线了，或者某个接口超时了），由于测试数据不稳定，UI自动化测试失败率会比较高。这时可以用Spider的固化测试数据功能，使UI自动化测试更加稳定，就是说，我们消除了数据不稳定的瓶颈，这样自动化会更加稳定。

下图是移动UI自动化结合Spider的测试报告： 利用Spider稳定的数据和跳转，在新版本回归测试时对老的功能进行图形对比测试（测试失败的会在对比不通过的地方自动标红）![Alt text](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2016/40787ca3.png)

Alt text



![Alt text](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2016/3d347c57.png)