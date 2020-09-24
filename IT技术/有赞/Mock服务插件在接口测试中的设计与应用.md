# Mock服务插件在接口测试中的设计与应用

# 引言

在日常的接口测试中，测试人员常常会遇到以下几种令人头疼的情况：

- 场景一：依赖的接口状态不稳定，导致集成 CI 常常失败，需要耗费大量时间排查非被测目标本身之外的环境问题
- 场景二：做异常测试时构造异常数据成本高、难度大，某些异常数据甚至无法通过正常途径构造
- 场景三：被测目标开发进度先于依赖模块，当测试需要先行介入接口测试，但依赖模块接口尚且不通

面对以上痛点，我们需要做什么？

# 一、概述

## 1.1 Mock 定义

Mock 是测试过程中中常见的一种技术，即对于某些不容易构造或者不容易获取的对象，用一个虚拟的对象来创建以便测试的测试方法，从而把测试与测试边界以外的对象隔离开。

> 引用《淘宝网-接口测试白皮书》中的对 Mock 的定义
>
> 在测试当中，mock 是指使用各种技术手段模拟出各种需要的资源以供测试使用。
>
> 被 mock 的资源通常有以下特征：
>
> - 被测目标依赖该资源
> - 该资源可能因为各种原因不稳定、返回结果不断变化或者并不总是能够获取到
> - 该资源跟被测目标本身质量无关
>
> 这些资源可能是一个外部或底层接口、一个系统、一组数据对象或者是一整套目标软件 的工作环境等。通过 mock 避免对外部真实资源的依赖实现对被测目标的孤立测试，从而大 大降低测试的难度，节约测试成本。

## 1.2 Mock 分类

测试中的 Mock 可以大致分为两类：mock 数据和 mock 服务。

- Mock 数据即 mock 一个对象，写入一些预期的值，通过它进行自己想要的测试。主要适用于单元测试，例如常见的 EasyMock、Mockito 等。
- Mock 服务即 mock 一个 sever，构造一个依赖的服务并给予他预期的服务返回值，适用范围广，更加适合我们的集成测试。因此我们就 mock server 这种模式进行设计与开发。

# 二、需求分析

## 2.1 核心场景

场景一：小明要测试一个普通商品创建订单接口 create，在创建订单的过程中会交易系统会调用店铺系统查询店铺状态接口 queryShop 和营销系统查询营销活动接口 queryUmp，但这两个接口不太稳定，导致订单创建用例常常失败，小明希望每次调用这两个接口都能直接返回200不影响下单流程；

场景二：小李也在测试订单创建接口，并且依赖店铺查询接口 queryShop 设计了三种店铺状态下的下单场景：店铺正常营业、店铺已打烊、店铺已过试用期未缴费。但是通过正常途径构造测试数据成本很高，需要创建三个店铺->设置店铺状态->创建商品->创建订单。小李希望三个用例调用店铺 query 接口时能返回预期的三个结果；

场景三：碰巧小红也在测试订单创建接口，他们的用例都集成在同一个 CI 中，但是小红的用例中商品参加了某个营销活动，她希望自己的用例访问营销活动查询接口 queryUmp 时能返回正常的结果，不被 mock 用例所影响。

## 2.2 需求整理

根据以上三个场景，加之适用于有赞测试环境模式，可归纳为大致六个需求：

1. 调用依赖接口时能够返回指定值（ mock 的基本功能）
2. 支持同时 mock 多个服务
3. 多个测试用例依赖同一个接口，运行时支持返回不同结果
4. 支持集成在日常 CI 中使用
5. 在一个测试套件中只有部分用例需要 mock 接口 A，其他用例则需要正常的结果返回
6. 支持有赞 service chain 路由环境模式调用

# 三、设计思路

## 3.1 架构设计

整体设计架构图如下：![img](https://tech.youzan.com/content/images/2019/05/mock----1.png)Mock 插件设计分为两个部分：

1. bit-mocker 工程作为 jar 包引入我们的接口测试工程中，其中包含两个 Testng 的监听器。IMethodInterceptor 将普通用例与需要 mock 用例分组，优先执行 mock 用例。TestListenerAdapter 监听用例执行过程，在用例开始执行前获取所有要 mock 的服务列表，调用批量注册 mock 服务，在 mock 用例执行完毕后注销服务；
2. trade-mocker-service 工程作为 mock 服务的载体，承担着注册服务、提供服务、泛化调用、注销服务的功能。

## 3.2 实现方法

**前提**：由于有赞及大部分互联网公司均使用Dubbo框架进行项目开发，本文mock服务实现也是基于并适用于Dubbo框架。

现根据上述需求列表依次介绍实现细节：

### 1. 调用依赖接口时返回指定值（mock的基本功能）

——如下图所示，实现mock基本功能需要做两件事情：创建 provider、接收请求并返回期望 response：
![img](https://tech.youzan.com/content/images/2019/05/mock----.png)

- **创建 provider**

上图是一个极其简化的调用图，而众所周知 Dubbo 是通过将 provider 注册到注册中心，再由 consumer 订阅服务，通过注册中心返回到地址来实现调用的。因此我们需要将需要 mock 的服务注册到注册中心才算完成创建。

第一步：将需要 mock 的应用根据 groupId 和 artifactId 从 maven 仓库中拉取到最新版本的 jar 包到本地服务器上。

第二步：本地暴露 mock 服务。配置 Dubbo Provider 有4种方式：XML配置，properties 方式配置，API 调用方式配置，注解方式配置。由于我们的出发点是能够灵活的运用于接口测试中，势必要通过入参来决定 mock 什么服务，因此在 provider 的配置方式上选择了自由度更高的代码配置，而非更加常见的 XML 配置。配置代码如下：

```java
//从入参中获取所有需要暴露的服务List，依次进行暴露
mockServiceModel.getApplications().stream().forEach(application -> application.getServices().stream().forEach(service -> {
    ServiceConfig serviceConfig = new ServiceConfig();
    serviceConfig.setApplication(new ApplicationConfig(application.getApplication()));
    serviceConfig.setProtocol(new ProtocolConfig(PROTOCOL, application.getPort()));
    //暂时没有设置注册中心，下一步单独注册
    serviceConfig.setRegistry(new RegistryConfig("N/A"));
    serviceConfig.setInterface(service);
    //设置泛化调用的实现类
    serviceConfig.setRef(new MockGenericService(map));
    //设置拦截器
    serviceConfig.setFilter("mockFilter");
    //服务暴露
    serviceConfig.export();

    //获取暴露后的dubbo服务ip及端口号
    URL exportUrl = (URL) serviceConfig.getExportedUrls().get(0);
    application.setIp(exportUrl.getIp());
    application.setPort(exportUrl.getPort());
}

```

第三步：将服务注册到注册中心。有赞目前使用的注册中心是 ETCD，可以直接通过拼接 URL 的方式进行调用注册，但无论是 ETCD、ZooKeeper 或是其他注册中心，实现方式大同小异。

- **接收请求并返回期望 response**

第一步：设置调用拦截 filter。在上面配置 Dubbo Provider 的代码中我们已经将拦截器 mockFilter、泛化服务 MockGenericService 设置好了。拦截器和泛化服务都是实现自 Dubbo 原生接口，他们需要搭配使用，相辅相成。先看一下拦截器 mockFilter 实现于 Dubbo 的 [Filter](http://dubbo.apache.org/zh-cn/docs/dev/impls/filter.html) 接口。

在 MockFilter 中我们从 Invocation 里获取到客户端的调用方法、参数类型、参数值数组，放进服务端的 RpcInvocation 中，然后修改 RpcInvocation 中的方法、参数类型，将请求转发到我们暴露服务的唯一实现类 MockGenericService。

```java
public class MockFilter implements Filter {

    private static final Class<?>[] GENERIC_PARAMETER_TYPES = new Class<?>[] {String.class, String[].class, Object[].class};

    @Override
    public Result invoke(Invoker<?> invoker, Invocation invocation) throws RpcException {
        RpcInvocation rpcInvocation = (RpcInvocation) invocation;
        //获取调用参数、参数类型、请求方法，设置到RpcInvocation中
        rpcInvocation.setArguments(new Object[] { invocation.getAttachment("interface") + "." + invocation.getMethodName(),
            Arrays.stream(invocation.getParameterTypes()).map(clazz -> clazz.getName()).toArray(String[]::new),
            invocation.getArguments()});
        rpcInvocation.setParameterTypes(GENERIC_PARAMETER_TYPES);
        rpcInvocation.setMethodName(Constants.$INVOKE);
        //调用泛化服务
        return invoker.invoke(rpcInvocation);
    }
}
1234567891011121314151617
```

第二步：实现泛化调用，返回预设的 response。我们的泛化服务实现类 MockGenericService 实现自 Dubbo 的 [GenericService](http://dubbo.apache.org/zh-cn/docs/user/demos/generic-service.html) 接口。该接口可以说是 mock 功能的好搭档，目前业界很多 mock 方法也都是通过该接口来实现的。

在 MockGenericService 中我们根据 method 从预存好的 response map 中取出匹配的返回值，转换成该方法的返回参数 type。利用拦截器和泛化调用这一套组合拳，mock 的基本功能就实现了。以下为部分代码实现：

```Java
public class MockGenericService implements GenericService {
    //存放mock方法与返回参数
    private Map<String, Object> map;

    public MockGenericService(Map<String, Object> map) {
        this.map = map;
    }

    @Override
    public Object $invoke(String method, String[] parameterTypes, Object[] args) throws GenericException {
        //根据调用方法找到预设的mock返回参数
        Object value = map.get(method);
        Gson gson = new Gson();
        if (value instanceof Map) {
            value = gson.toJson(value);
        }
        String interfaceName = method.substring(0, method.lastIndexOf("."));
        String methodName = method.substring(method.lastIndexOf(".") + 1);
        try {
            Class[] parameterClasses = new Class[parameterTypes.length];
            for (int i = 0; i < parameterTypes.length; i++) {
                parameterClasses[i] = Class.forName(parameterTypes[i]);
            }
            //将返回参数转化为该调用方法的返回参数类型
            Type methodReturnType = Class.forName(interfaceName).getDeclaredMethod(methodName, parameterClasses).getGenericReturnType();
        return new Gson().fromJson(value.toString(), methodReturnType);
        } catch (ClassNotFoundException e) {
            throw new MockException(e);
        } catch (NoSuchMethodException e) {
            throw new MockException(e);
        }
    }
}

```

### 2. 支持同时 mock 多个服务

——想要在集成 CI 中使用，势必会有越来越多的接口需要 mock。我们将需要 mock 的服务以 List 的类型去触发服务的注册和暴露，事实上上面的代码中已经是这样做了。

### 3. 多个测试用例依赖同一个接口，运行时支持返回不同结果

——此时 mock 的服务已经暴露在注册中心，可是每一个方法调用时却想要得到不同的结果，因此我们需要在泛化服务中做改造。

利用我们平时写接口测试常用的框架 Testng 中的监听器（后面还会详细说到）监听每一个接口测试用例 的 onTestStart 时刻，在该用例调用测试之前将 mock 数据塞入到泛化服务中的 response map 中，那么随后请求过来的时候就能获取到在当前用例刚开始的时候最新插入的返回值。下一个请求又做同样的事情，周而复始保证每个请求都能得到对应测试用例预设的返回值；

### 4. 支持集成在日常 CI 中使用

——为了尽量简化使用者的操作步骤，我们用**监听器+自定义注解**的形式实现快速 mock。

首先看一下上面已经提到的过的 Testng 中的监听器，Testng 自带多种类型的监听器。我们的需求是能够把控用例执行节奏，并在各个执行节点中插入需要做的方法，因此我们选择的监听器是 TestListenerAdapter，实现自 [ITestListener](https://javadoc.jitpack.io/com/github/cbeust/testng/master/javadoc/org/testng/ITestListener.html)。

在所有接口测试用例执行前，也就是 onStart 时获取所有需要 mock 的服务列表进行批量注册。

在执行每一个具体测试方法前 onTestStart，我们需要将该用例对应的 mock 返回值塞入 mock 服务的泛化调用中。

这时我们已完成了大部分的 mock 工作，但还差一个完美的 ending，那就是把注册的 mock 服务全部下线，并 kill 对应进程。这么做一是为了不影响其他人在测试环境中的正常使用，二是维护 mock 服务器的稳定性。这部分内容则放在所有测试运行完毕之后 onFinish。 我们看一下具体的代码实现：

```java
public class MockableListener extends TestListenerAdapter {
    @Override
    public void onStart(ITestContext testContext) {
        super.onStart(testContext);
        Set<Class> testClasses = Arrays.stream(testContext.getAllTestMethods())
            .map(testMethod -> testMethod.getTestClass().getRealClass())
            .collect(Collectors.toSet());
        //初始化mock服务，包括设置sc，注册mock服务
        initMockService(testContext, testClasses);
        //添加一个jvm关闭的钩子，其他情况退出时也会调用注销mock服务
        Runtime.getRuntime().addShutdownHook(new Thread(() -> killMock(testContext)));
    }

    @Override
    public void onTestStart(ITestResult result) {
        super.onTestStart(result);
        Method method = result.getMethod().getConstructorOrMethod().getMethod();
        ITestContext iTestContext = result.getTestContext();
        //设置mock返回值
        mockData(iTestContext ,method);
    }

    @Override
    public void onFinish(ITestContext testContext) {
        super.onFinish(testContext);
        //下线服务并kill对应进程
        killMock(testContext);
    }
}

```

再来看一下自定义注解，我们一共设置了两个自定义注解 @Mock、@MockData。

在测试类前添加 @Mock 注解，注解着中填写需要 mock 服务的 application、services、groupId、artifactId，在解析到注解中填写的内容后去拉取对应 jar 包，注册服务。

在测试方法前添加 @MockData，里面填上具体想要 mock 的方法及对应返回参数。在每一次调用测试方法时都会读取该注解内的内容塞入 mock 服务的泛化服务中等待调用时返回。

### 5. 一个测试套件中只有部分用例需要 mock 接口 A，其他用例则需要正常的结果返回

——在之前的设计中，当 mock 服务注册到注册中心后，它会一直存活在注册中心，直到所有测试结束才会注销，这样势必会影响正常用例的执行结果。当时我设计了三个方案：

1. 增加判断条件，如果该方法不需要 mock，则在泛化服务中将请求转发至基础环境，再将正常返回值返回给调用方；
2. 调整服务注册与下线的时间点，需要 mock 服务时立即 register，当前用例执行完毕立刻 unRigister;
3. 控制 Testng 中用例执行顺序，将需要 mock 的测试方法放在最前面执行，执行完毕后统一下线；

对比了三个方案，方案1改造量大逻辑复杂，方案2对性能损耗过大且易造成不稳定现象，最终选择了方案3。运用Testng中控制测试顺序的监听器 [IMethodInterceptor](https://javadoc.jitpack.io/com/github/cbeust/testng/master/javadoc/org/testng/IMethodInterceptor.html) 加以实现。

首先将接口测试用例分为 mock 用例与普通用例两组，优先执行 mock 用例，代码如下。然后在上方的 TestListenerAdapter 监听器中 onTestStart 状态节点增加 mock 用例是否执行完毕判断，如果是，则下线 mock 服务。

```java
    @Override
    public List<IMethodInstance> intercept(List<IMethodInstance> methods, ITestContext context) {
        List<IMethodInstance> result = new ArrayList<>();

        methods.forEach(method -> {
            Test test = method.getMethod().getConstructorOrMethod().getMethod().getAnnotation(Test.class);
            Set<String> groups = new HashSet<>();
            Arrays.stream(test.groups()).forEach(group -> groups.add(group));
            //将mock用例与普通用例分组，设置执行顺序
            if (groups.contains("mock")) {
                result.add(0, method);
            } else {
                result.add(method);
            }
        });
        return result;
    }

```

### 6. 支持有赞 service chain 路由环境模式调用

——有赞环境具体实现和运行逻辑可以参考[有赞环境解决方案](https://mp.weixin.qq.com/s?__biz=MzAxOTY5MDMxNA==&mid=2455758814&idx=1&sn=87620066de1f570280630c20f4d99579&chksm=8c6861fbbb1fe8ed609b5215b226326442acf73851dae73928266909dd17fb958c7211a2d615&scene=21#wechat_redirect)，本文仅简单介绍与 mock 实际应用息息相关的部分就是测试环境多环境实现：全链路标识透传 service chain 方案，下方简称 sc。

当客服端发起调用时如果带了 sc 标，那么无论什么业务应用，何种协议、框架，都必须将源端的 sc 标识透传下去，在 RPC 调用过程中每一次的调用都会匹配 provider 是否有对应带 sc 标的服务，如果有，则请求到指定的带 sc 标服务上；如果没有，则默认走到不带任何 sc标的基础环境；

为了适用于有赞 sc 环境方案，我们也是利用 TestListenerAdapter 监听器，在实例化测试类之后和调用任何配置方法之前，自动查询配置文件，以及是否手工 set 过 sc 值，如果有，则在我们 mock 服务信息中添加对应的 sc 信息，并注册到 etcd 上；如果没有，则自动生成一个虚拟 sc，以防影响基础环境的正常调用。sc 环境中调用关系简化图如下：![img](https://tech.youzan.com/content/images/2019/05/sc-----mock---1.png)

需要注意的是，若该 sc 环境中已有正常服务 A，再 mock 一个服务 A，会导致同一个 sc 上有两个服务，此时调用会因为均衡负载的原理随机调用。所以该场景不支持也不允许。

# 四、整体实现

为了将整个实现细节流程串在一起便于大家理解，将全流程调用及实现画在以下时序图中：![img](https://tech.youzan.com/content/images/2019/05/bit-mocker-2.jpg)

# 五、实际应用

## 5.1 插件应用

操作步骤：

- Step0: 引入 jar 包，并按原步骤编写执行接口测试
- Step1: 测试类前添加 @Listeners({MockableListener.class}) 注解
- Step2: 测试类前添加 @Mock 注解，填写mock的应用和接口以及接口所属的 groupId、artifactId
- Step3: 测试方法前添加 @MockData 注解，填写 mock 接口的方法，以及 mock 数据对应的方法
- Step4: 按原步骤添加业务校验

指定sc：

- 如配置文件中没有指定 sc 环境则在 @Mock 中会随机生成 sc
- 如在指定 sc 环境跑接口用例，mock 服务会使用当前 sc 标识，导致同一个 sc 有两个相同服务注册，所以禁止 mock 当前 sc 环境中已有的服务！

mock多服务：

- 测试类前添加多个 @Mock 注解

mock信息：

- 增加一个返回值为需要mock的数据的方法，与@MockData注解中方法名对应

## 5.2 Demo 展示

以需求分析中的场景二为例，测试一个创建订单接口 create，mock 店铺查询接口 queryShop 返回店铺已打烊，校验结果为下单失败。

```java
//添加监听器
@Listeners({MockableListener.class})
//添加 @Mock 注解及 mock 应用、接口信息
@Mock(application = "shop-prod", services = "com.youzan.shopcenter.xxx.xxx.xxx", groupId = "com.youzan.shopcenter", artifactId = "shopprod-api")
public class MockdemoTest extends BaseTradeTest {
    //添加 @MockData 注解及 mock 方法和对应的返回参数
    @MockData(mockMethod = "com.youzan.shopcenter.xxx.xxx.xxx.queryShop", dataMethod = "mockData")
    @Test
    public void testMock1(){
        // 下单数据构造
        OrderCreationDTO orderCreationDTO = JSON.parseObject(NormalCreate, OrderCreationDTO.class);
        // 调用订单创建接口
        PlainResult<OrderCreationVO> rsCreate = tradeService.create(orderCreationDTO);
        //校验订单创建结果与mock是否一致
         Assert.assertEquals(rsCreate.getMessage(),"该店铺已打烊，暂无法购买，请联系商家。");
    }

    // mock 返回参数构造
    public static PlainResult<List<ShopAbilityInfo>> mockData() {
        PlainResult<List<ShopAbilityInfo>> result = new PlainResult<List<ShopAbilityInfo>>();
        result.setCode(200);
        result.setMessage("successful");
        ShopAbilityInfo shopAbilityInfo = new ShopAbilityInfo();
        shopAbilityInfo.setKdtId(28945646);
        shopAbilityInfo.setAbilityCode("trade_online_order_ability");
        //设置店铺打烊
        shopAbilityInfo.setInvalidCode("SHOP_PROD_RELATION_INVALID");
        result.setData(shopAbilityInfo);
        return result;
    }
}

```

## 5.3  Mock 使用原则

使用时不能过度依赖 mock，而需要从 mock 的必要性以及投入产出比考虑，可以基于以下两个原则考虑：

- 只对构造步骤复杂、构造耗时较长、不稳定的依赖对象/服务进行mock。
- 依赖对象/服务的逻辑正确性与稳定性与我们测试的对象无关。