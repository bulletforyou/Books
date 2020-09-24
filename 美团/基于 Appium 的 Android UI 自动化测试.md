# [基于 Appium 的 Android UI 自动化测试](https://tech.meituan.com/2016/11/24/appium-mock-test.html)

自动化测试是研发人员进行质量保障的重要一环，良好的自动化测试机制能够让开发者及早发现编码中的逻辑缺陷，将风险前置。日常研发中，由于快速迭代的原因，我们经常需要在各个业务线上进行主流程回归测试，目前这种测试大部分由人工进行，费时费力，重复劳动多。如果能将UI自动化测试与主流程回归结合到一起，一方面保证了代码质量，另一方面大大节约人力成本，可谓一举两得。

### 为什么需要UI自动化测试

原因主要是以下三点：

- 保证质量——及早发现代码缺陷，风险前置。
- 减少重复劳动，节约人力——快速迭代中经常需要进行主流程回归，测试完整个主流程，需要耗费相当大的人力成本。
- 统一标准——每个人对测试用例以及业务理解程度不同，标准可能存在不一致。

### 进行UI自动化测试面临的问题

- 工具选择。
- 降低对后端的依赖，避免因为测试环境后端不稳定导致的测试失败。
- 整合测试用例，增加复用，降低用例维护成本。

### 自动化测试工具对比

业界UI测试工具发展迅速，目前有Robotium、Appium、Espresso、UIAutomator、Calabash等等，其中在Android中应用最广泛的当属UIAutomator、Robotium、Appium。

下面列表比较说明：

|UIAutomator|Robotium|Appium —|—|—|— 支持平台|Android|Android，H5|Android，iOS，H5 脚本语言|Java|Java|Almost any 是否支持无源码测试 |Yes|Yes|Yes 支持API级别|16+|All|All

除了Android、Hybrid类型的App，Appium还可以在iOS设备上运行。加上之前组内有同事做过Appium方面的分享，在这方面有一定的基础，所以最终我们选择了Appium。

### 接口稳定性与数据可变性

业务特性决定我们的case在运行过程中会经常向后端请求数据，然后根据后端接口返回的数据决定页面元素展示。因此，有两个难点是必须克服的：

1. 后端接口稳定性 测试环境并不像线上，能在7x24内保持稳定。业务接口经常出现因所依赖的外部环境异常而请求失败的情况，以往处理这种情形，我们能做的事情往往很有限，最糟糕的就是必须要等待第三方修改完成后，才能继续我们的测试。因此，如何保持接口稳定，将成为UI自动化测试不得不面对的问题。
2. 测试数据配置与保存 克服了1中提到的接口稳定难点后，仍然要面对第二个难点——频繁修改配置以适应测试用例的条件。举个例子，对于闪惠业务，用例里面会对于商户配置的多种情况进行测试（无优惠、有优惠未开始、仅有闪惠优惠、有闪惠和团购、闪惠打折、闪惠赠品等），这里面的条件是复杂多变的。如果每一次进行测试前，都由执行测试人在商户后台登录后手动修改配置，将耗费巨大的人力成本。因此我们势必找出一条途径，将这种繁琐的配置过程自动化。

### 接入Appmock

> 注：使用Appmock，需建立在App底层网络请求模块已经具备切换mock地址的功能的基础上。

Appmock是美团平台组制作的非常优秀的mock工具，其前身是美团同事张文东所编写的wendong.dp（仅供美团内部使用）。在Appmock上可以进行网络请求的查看与mock。那么，是否可以让我们的自动化测试用例在运行时访问Appmock，获取预设的mock数据呢？做过相关App开发的同事都知道，在App中这是很容易实现的，只要访问某个特定HTTP链接进行注册即可。

##### Appmock使用界面

![Appmock使用界面](https://tech.meituan.com/2016/11/24/img/appium-mock-test/appmock.png)

Appmock使用界面



由此，“后端接口稳定性”的问题，在Appmock的帮助下就解决了，如果把后端数据直接配置在Appmock上，请求失败的概率就微乎其微。即便如此，仍然要面临频繁修改配置的需求，只不过是把修改的操作从商家后台页面转移到了mock系统。有没有什么方法，可以让修改配置的操作自动化进行呢？

在研读过Appmock的源码后，我们想到，可以自己搭建一个mock-server，把不同阶段的mock数据保存在数据库中，并且开放出网络接口，用来切换各个测试用例所需的mock数据。具体的系统结构如下图所示。

![img](https://tech.meituan.com/2016/11/24/img/appium-mock-test/mock.png)

上图描述了一次用例运行的简要过程，事前需要在数据库中准备好测试数据，mock-server基于Appmock，使用NodeJS进行二次开发完成。

### 编写测试用例

为了简化用例编写，减少开发与维护的工作量，使用Page Object模式进行用例开发。

Page Object定义为抽象页面的对象，通过对页面功能的封装，进行相应操作。它的优点是：

- 减少重复代码，增加复用性。
- 提高代码可读性、稳定性。
- 易于维护。

![img](https://tech.meituan.com/2016/11/24/img/appium-mock-test/framework.png)

UI自动化测试框架的编写方式类似于MVC架构，我们将测试用例中的业务逻辑、各个页面间的元素以及测试数据相分离后独立编写，以下均用排队业务的主流程举例。

#### 测试类组成

测试类的组成包括`setUp()`，`tearDown()`方法以及各个测试用例`testXXXX()`，所有的测试用例必须以小写test开头，如正常排号下的`testQueueNormalQueue()`：

```java
@Before
public void setUp() throws Exception {
    File apk = new File(APK_NOVA);
    DesiredCapabilities capabilities = DesiredCapabilities.android();
    capabilities.setCapability("device", Platform.ANDROID);
    capabilities.setCapability(CapabilityType.VERSION, "5.1");
    ……       // capabilities各个常量字段
    driver = new AndroidDriver<AndroidElement>(new URL("http://127.0.0.1:4723/wd/hub"), capabilities);
    splashScreen = new SplashScreen(driver);
    mainPage = new MainPage(driver);
    ……       // Page Object初始化
}
@After
public void tearDown() throws Exception {
    driver.quit();
}
@Test
public void testQueueNormalQueue() {
	// 略
}
```

测试用例中不用直接对页面元素进行操作，我们所要做的事情仅仅是业务层面的逻辑，包括表单数据的提交、页面按钮的点击跳转等等。

#### 页面类编写

页面类的编写采用Page Object模式，包括页面中会使用到的元素、页面元素的操作方法集以及页面元素的检验方法集。 所有的`Page`子类均继承`BasePage`父类，它要做的事情很简单，无非就是1个`driver`，2个`driverWait`用于延时加载的等待时间，以及页面元素的初始化：

```java
public class BasePage {
    private static final int TIMEOUT = 1;             // short timeout for web-element
    private static final int TIMEOUT_LONG = 10;       // long timeout for web-element
    public AndroidDriver<AndroidElement> driver;
    public WebDriverWait driverWait;
    public WebDriverWait driverLongWait;
    public BasePage(AndroidDriver<AndroidElement> driver) {
        this.driver = driver;
        this.driverWait = new WebDriverWait(this.driver, TIMEOUT);
        this.driverLongWait = new WebDriverWait(this.driver, TIMEOUT_LONG);
        PageFactory.initElements(this.driver, this);  // 这句非常重要，如果不写的话尽管编译不会报错，但是后面要说的页面元素在运行时一个都找不到
    }
}
```

然后是各个`Page`子类的实现方法：

```java
public class ShopInfoPage extends BasePage {
    public ShopInfoPage(AndroidDriver<AndroidElement> driver) {
        super(driver);
    }
    …… // 页面元素 @FindBy
    …… // 操作方法，比如login()、clickXXXXXXButton()、gotoXXXXXXPage()
    …… // 检验方法，比如checkLoaded()、checkLoginSuccess()、checkQueue_LoginReadyQueue()
}
```

Page子类的元素定位我们使用`@FindBy`注解方式进行统一的管理。

元素定位最基本的方法就是使用`id/name/class`等，如果不行的话就用相对复杂却无所不能的`xpath`，如：

```java
// 点击登录按钮
@FindBy(id = "login_tip")
private WebElement clickLoginButton;
 
 
// MAPI域名输入框
@FindBy(xpath = "//*[contains(@resource-id, 'id/mapi_item')]//*[contains(@resource-id, 'id/debug_domain')]")
private WebElement mapiDomainText;
```

Page中的操作和检验方法调用已经封装好的BaseUtils中的方法，如：

```java
BaseUtils.waitForElement(driverWait, loginButton).click();                              // 等待元素出现并点击
Assert.assertTrue(BaseUtils.waitForElementVisibility(driverLongWait, usernameText));    // 检验元素应该展示在页面上
```

#### BaseUtils方法

BaseUtils中封装好了一些通用的方法，还需要不断完善并扩展。下面介绍其中一些常用及重要的方法：

1. `openDebugPanel()`：每次直接调用该方法来打开Debug面板，由于Debug面板是一个系统层面的悬浮窗，它不属于任何页面中的元素（你完全没办法通过`ID`甚至`XPath`获得）。
2. `clickPoint()`：点击某个坐标+持续时间，坐标采用相对屏幕位移的方式（左上为0,0），这里只实现了简单的单指的点击操作，实际上`driver.tap`可以模拟多指的共同操作。
3. `swipeToUp() & swipeToDown()`：上拉 & 下拉页面操作，需要传的是次数和每次持续时间，模拟手指在屏幕上的滑屏操作，主要用于刷新页面以及绕过某些有坑的`scrollTo`。
4. `prepareMockData()`：这里要做的就是，在关键步骤操作前传入`mock_data_id`，我们会将数据请求发送给服务器，然后服务器从数据库拉到对应的mock data并更新。
5. `saveScreenshot()`：顾名思义，截图。在每个重要的页面操作方法中加入即可，需要传入的是`case_id`以及操作或检查时的`keyword`，方便在用例执行完以后看截图分析和Bug复现。
6. `waitForElementXXX()`：在预设等待时间内等待元素出现并定位元素。

### UI自动化测试运行效果

在排队与闪惠两条业务线进行了UI自动化测试实践，它们执行完成全套用例的耗时均不超过20min。相比于之前人工进行主流程测试动辄花费半天的工作量的情况，大大降低了人力成本，将工程师宝贵的时间节约给了更有价值的研发工作。

当然，自动化测试前期的环境搭建、数据准备、用例编写等任务是必不可少的，这些准备工作很多都是一次性投入，一劳永逸，也正是自动化测试的价值所在

### 参考资料

1. [Appium Doc](http://appium.io/slate/en/master)
2. [Page Object Design Pattern](http://www.seleniumhq.org/docs/06_test_design_considerations.jsp#page-object-design-pattern)