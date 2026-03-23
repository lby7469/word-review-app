#include <iostream>
using namespace std;

// 定义二叉树节点结构
struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    
    // 构造函数
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

// 二叉树类
class BinaryTree {
private:
    TreeNode* root;
    
    // 前序遍历递归函数
    void preorderHelper(TreeNode* node) {
        if (node == nullptr) return;
        
        cout << node->val << " ";  // 访问根节点
        preorderHelper(node->left);  // 遍历左子树
        preorderHelper(node->right); // 遍历右子树
    }
    
    // 中序遍历递归函数
    void inorderHelper(TreeNode* node) {
        if (node == nullptr) return;
        
        inorderHelper(node->left);   // 遍历左子树
        cout << node->val << " ";    // 访问根节点
        inorderHelper(node->right);  // 遍历右子树
    }
    
    // 后序遍历递归函数
    void postorderHelper(TreeNode* node) {
        if (node == nullptr) return;
        
        postorderHelper(node->left);  // 遍历左子树
        postorderHelper(node->right); // 遍历右子树
        cout << node->val << " ";     // 访问根节点
    }
    
    // 递归释放节点内存
    void destroyTree(TreeNode* node) {
        if (node == nullptr) return;
        
        destroyTree(node->left);
        destroyTree(node->right);
        delete node;
    }
    
public:
    // 构造函数
    BinaryTree() : root(nullptr) {}
    
    // 析构函数
    ~BinaryTree() {
        destroyTree(root);
    }
    
    // 创建示例二叉树
    void createSampleTree() {
        /*
        创建如下二叉树：
              1
             / \
            2   3
           / \
          4   5
        */
        
        root = new TreeNode(1);
        root->left = new TreeNode(2);
        root->right = new TreeNode(3);
        root->left->left = new TreeNode(4);
        root->left->right = new TreeNode(5);
    }
    
    // 前序遍历
    void preorder() {
        cout << "前序遍历结果：";
        preorderHelper(root);
        cout << endl;
    }
    
    // 中序遍历
    void inorder() {
        cout << "中序遍历结果：";
        inorderHelper(root);
        cout << endl;
    }
    
    // 后序遍历
    void postorder() {
        cout << "后序遍历结果：";
        postorderHelper(root);
        cout << endl;
    }
};

int main() {
    // 创建二叉树对象
    BinaryTree tree;
    
    // 创建示例树
    tree.createSampleTree();
    
    // 执行三种遍历
    cout << "二叉树遍历演示" << endl;
    cout << "==================" << endl;
    
    tree.preorder();
    tree.inorder();
    tree.postorder();
    
    cout << "==================" << endl;
    
    return 0;
}