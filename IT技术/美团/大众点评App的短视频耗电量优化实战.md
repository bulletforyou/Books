# [大众点评App的短视频耗电量优化实战](https://tech.meituan.com/2018/03/11/dianping-shortvideo-battery-testcase.html)

## 前言

美团测试团队负责App的质量保证工作，日常除了App的功能测试以外，还会重点关注App的性能测试。现在大家对手机越来越依赖，而上面各App的耗电量，直接影响了手机的待机时间，是用户非常关心的一点。本文主要通过一个典型案例，介绍App性能测试中的电量测试，并总结了我们由此引发的一些思考。

## 一、案例分析

短视频作为已被市场验证的新内容传播载体，能有效增加用户停留时长。大众点评App从9.3版本开始推出短视频相关内容，在各页面新增了短视频模块。在短视频功能测试中，我们发现如果在视频列表页中播放视频，手机很快就会发烫。针对这种现象，我们马上拉取数据进行了分析，测试数据表明，视频列表页耗电量竟然是详情页的**11倍**。这是怎么回事儿呢？

目前行业内有很多电量测试的方法，我们采用的是[Battery Historian](https://github.com/google/battery-historian)，这是Google推出的一款Android系统电量分析工具，支持5.0(API 21)及以上系统手机的电量分析。

### 1. 测试对象

短视频主要包括三个核心页面：视频列表页、视频详情页、作者页，本次的测试对象就是这三个页面。

![img](https://p1.meituan.net/travelcube/9fbbe9679486ee45aae46504837f880467417.jpg)

### 2. 测试过程

**测试机型**：华为Mate 9 Android 7.0 **电池容量**：4000mAh
**播放的视频时长**：1min15s **测试场景设计**：WiFi环境下，打开App，播放视频，通过点击“重新播放”，连续播放10次 **对比场景**：停在App首页20min，手机不灭屏 **注意**：测试过程不充电，每次测试环境一致

### 3. 测试结果

如下是Battery Historian测试结果部分截图：

![视频列表页](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/68ae286e.png)

视频列表页



![视频详情页](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/cf681242.png)

视频详情页



对测试结果数据进行汇总整理：

![img](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/4f504ddc.png)

消耗电量：系统总电量的占比

从测试结果可以看到，短视频列表页耗电量特别高，是视频详情页的**11倍**。

### 4. 问题定位

视频列表页消耗电量过高，从测试数据可以很明显的看出来，视频列表页CPU占用时间高很多。从播放器布局来看，列表页和作者页比视频详情页只是多出了动画音符。如下图，红框中圈出的视频左下角的音符。

![img](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/087fd7e2.png)

电量消耗差异这么大，是否跟动画音符有关呢。为了排除这个问题，重新编译了一个去掉动画音符的APK进行测试。测试结果：

![img](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/f4ab80c9.png)

从测试结果来看，CPU和耗电量很明显都下降了很多，因此确定是动画音符引起的。打开GPU视图更新的开关，查看三个页面的绘制情况。打开视频列表页，可以看到，动画音符每波动一次，会导致整个页面都在不停的绘制。如下是视频列表页绘制的情况：

![img](https://p1.meituan.net/travelcube/9dadbaa0f6007be100df6b814699af143567496.gif)

从动图可以很明显看出该页面绘制十分异常，动画音符每波动一次，会导致整个页面都重新绘制一遍。

所以，到这里就明白了问题的原因，**因为页面上动画音符的实现方式有问题，动画音符波动时，导致整个页面会跟着一起不停的重新绘制。而页面的重复绘制，会使App CPU占用比正常情况下高出很多，进而导致耗电量高。**

### 5. 修复后验证

定位到原因之后，开发针对性的进行了修复。动画音符柱状图的实现，之前设计由多个可变化的单柱形View组成，单个柱形View重写了onMeasure & OnDraw方法，从外部柱状图View中初始化单个柱子的高度，然后自动根据一个函数式来变化高度。**因为每次都需要层层调用Measure和对应的Layout，所以造成外层控件的多次layout，进而造成CPU占用率增大**。修复之后，使用另一种方式实现，只重写了View的OnDraw方法，每次使用Canvas画出所有柱状图，使用ValueAnimator来计算变化柱状图高度，**也不再影响父控件的Layout**。如下是修复前后的核心代码：

![img](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/4e3f9f32.png)

![img](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/a302ea26.png)

修复之后动画音符波动时的绘制区域：

![img](https://p1.meituan.net/travelcube/816376660586641a18854c6efe5eb3ba3327156.gif)

修复之后，重新使用Battery Historian进行验证，测试结果：

![img](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/1224587f.png)

从上面的测试结果，可以看到，视频列表页和作者页，**耗电情况得到明显的优化**。

总结一下，短视频耗电量的问题，**是由于错误的绘制方法，导致CPU占用过高，进而导致耗电量高**。那么因为动画音符导致耗电量异常的问题到这里就完美的解决了。CPU负载高，会导致耗电量高是显而易见的。但是还想深入探索一下，在手机系统各App耗电量排行榜中，耗电量是怎么计算的？还有哪些因素会影响耗电量呢？带着这些疑问，我们来看看系统计算耗电量的原理。

## 二、耗电量计算原理

根据物理学中的知识，功=电压*电流*时间，但是一部手机中，电压值U正常来说是不会变的，所以可以忽略，只通过电流和时间就可以表示电量。**模块电量(mAh)=模块电流(mA)\*模块耗时(h)**。模块耗时比较容易理解，但是模块电流怎样获取呢，不同厂商的手机，硬件不同，是否会影响模块的电流呢。看一下系统提供的接口：./frameworks/base/core/java/com/Android/internal/os/PowerProfile.java

该类提供了public double getAveragePower(String type)接口，type可取PowerProfile中定义的常量值，包括POWER_CPU_IDLE（CPU空闲时），POWER_CPU_ACTIVE（CPU处于活动时），POWER_WIFI_ON（WiFi开启时）等各种状态。并且从接口可以看出来，每个模块的电流值，是从power_profile.xml文件取的值。PowerProfile.java只是用于读取power_profile.xml的接口而已，后者才是存储系统耗电信息的核心文件。power_profile.xml文件的存放路径是/system/framework/framework-res.apk。

以Nexus 6P为例，在该路径获取到framework-res.apk文件。使用apktool，对framework-res.apk进行反解析，获取到手机里面的power_profile.xml文件，内容如下所示：

```xml
<?xml version="1.0" encoding="utf-8"?>
<device name="Android">
    <item name="none">0</item>
    <item name="screen.on">169.4278765</item>
    <item name="screen.full">79.09344216</item>
    <item name="bluetooth.active">25.2</item>
    <item name="bluetooth.on">1.7</item>
    <item name="wifi.on">21.21733311</item>
    <item name="wifi.active">98.04989804</item>
    <item name="wifi.scan">129.8951166</item>
    <item name="dsp.audio">26.5</item>
    <item name="dsp.video">242.0</item>
    <item name="gps.on">5.661105191</item>
    <item name="radio.active">64.8918361</item>
    <item name="radio.scanning">19.13559783</item>
    <array name="radio.on">
        <value>17.52231575</value>
        <value>5.902211798</value>
        <value>6.454893079</value>
        <value>6.771166916</value>
        <value>6.725541238</value>
    </array>
    <array name="cpu.speeds.cluster0">
        <value>384000</value>
        <value>460800</value>
        <value>600000</value>
        <value>672000</value>
        <value>768000</value>
        <value>864000</value>
        <value>960000</value>
        <value>1248000</value>
        <value>1344000</value>
        <value>1478400</value>
        <value>1555200</value>
    </array>
    <array name="cpu.speeds.cluster1">
        <value>384000</value>
        <value>480000</value>
        <value>633600</value>
        <value>768000</value>
        <value>864000</value>
        <value>960000</value>
        <value>1248000</value>
        <value>1344000</value>
        <value>1440000</value>
        <value>1536000</value>
        <value>1632000</value>
        <value>1728000</value>
        <value>1824000</value>
        <value>1958400</value>
    </array>
    <item name="cpu.idle">0.144925583</item>
    <item name="cpu.awake">9.488210416</item>
    <array name="cpu.active.cluster0">
        <value>202.17</value>
        <value>211.34</value>
        <value>224.22</value>
        <value>238.72</value>
        <value>251.89</value>
        <value>263.07</value>
        <value>276.33</value>
        <value>314.40</value>
        <value>328.12</value>
        <value>369.63</value>
        <value>391.05</value>
    </array>
    <array name="cpu.active.cluster1">
        <value>354.95</value>
        <value>387.15</value>
        <value>442.86</value>
        <value>510.20</value>
        <value>582.65</value>
        <value>631.99</value>
        <value>812.02</value>
        <value>858.84</value>
        <value>943.23</value>
        <value>992.45</value>
        <value>1086.32</value>
        <value>1151.96</value>
        <value>1253.80</value>
        <value>1397.67</value>
    </array>
    <array name="cpu.clusters.cores">
        <value>4</value>
        <value>4</value>
    </array>
    <item name="battery.capacity">3450</item>
    <array name="wifi.batchedscan">
        <value>.0003</value>
        <value>.003</value>
        <value>.03</value>
        <value>.3</value>
        <value>3</value>
    </array>
</device>
```

从文件内容中可以看到，power_profile.xml文件中，定义了消耗电量的各模块。如下图所示：

![img](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/e49562cf.png)

文件中定义了该手机各耗电模块在不同状态下的电流值。刚刚提到，电量只跟电流值和时间相关，所以通过这个文件，再加上模块的耗时，就可以计算出App消耗的电量，**App电量=∑App模块电量**。划重点，手机系统里面的电量排行，也是根据这个原理计算的。

了解原理对于平常在App耗电量的测试有很大的帮助。因为获取到手机power_profile.xml文件，就可以清楚的知道这个手机上，哪些模块会耗电，以及哪些模块在什么状态下耗电量最高。那么测试的时候，应该重点关注调用了这些模块的地方。比如App在哪些地方使用WiFi、蓝牙、GPS等等。

例如最近对比测试其他App发现，在一些特定的场景下，该App置于前台20min内，扫描了WiFi 50次，这种异常会导致App耗电量大大增加。并且反过来，当有case报App耗电量异常时，也可以从这些点去考虑，帮助定位问题。

## 三、电量测试方法总结

![img](https://awps-assets.meituan.net/mit-x/blog-images-bundle-2018a/7d66def3.png)

如上，列出的一些常用的电量测试方法。综合各方法的优缺点，在定制个性化电量测试工具之前，目前采用的方法是Battery Historian。目前行业内，App耗电测试有很多种方案，如果仅仅测试出一个整体的电量值，对于定位问题是远远不够的。**借助Battery Historian，可以查看自设备上次充满电以来各种汇总统计信息，并且可以选择一个App查看详细信息**。所以QA的测试结果反馈从“这个版本App耗电量”高，变成“这个版本CPU占用高”“这个版本WiFi扫描异常”，可以帮助更快的定位到问题原因及解决问题。

当然，除了测试方法和测试工具，测试场景设计也非常重要。如果是在App内毫无规律的浏览，即使发现页面有问题，有很难定位到是哪个模块的问题。所以要针对性的设计场景，并且进行一些场景的对比，找出差异的地方。

## 四、总结

本文主要通过一个案例，介绍关于App电量测试中使用的一些基本方法和思路。电量测试采用的Battery Historian方法，虽然能初步解决问题，但是在实际的应用场景中还存在很多不足。目前美团云测平台，已经集成了电量测试方法，通过自动化操作，获取电量测试文件并进行解析，极大的提高了测试效率。目前每个版本发布之前，我们都会进行专门的电量测试，保障用户的使用体验。在电量测试方面，美团测试团队还在持续的实践和优化中。

### 作者简介

- 倩云，美团客户端测试开发工程师，2015年加入美团，主要负责大众点评App基础功能及Android专项测试工作。